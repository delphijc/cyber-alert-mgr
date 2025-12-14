async function removeDuplicates(db) {
    console.log('Running deduplication...');
    const stats = {
        alertsRemoved: 0,
        rulesRemoved: 0,
        mappingsRemoved: 0
    };

    // 1. Deduplicate Alerts based on external_id, keeping the latest one
    // Find duplicates: grouping by external_id having count > 1
    const duplicates = await db.all(`
        SELECT external_id, COUNT(*) as count 
        FROM alerts 
        GROUP BY external_id 
        HAVING count > 1
    `);

    for (const dup of duplicates) {
        // Get all IDs for this duplicate set, ordered by published_date DESC (latest first)
        const entries = await db.all(`
            SELECT id 
            FROM alerts 
            WHERE external_id = ? 
            ORDER BY published_date DESC, id DESC
        `, [dup.external_id]);

        // Keep the first one (index 0), delete the rest
        const toDelete = entries.slice(1);
        for (const entry of toDelete) {
            await db.run('DELETE FROM alerts WHERE id = ?', [entry.id]);
            stats.alertsRemoved++;
        }
    }

    // 2. Remove orphaned YARA rules (rules pointing to non-existent alerts)
    const orphansRules = await db.run(`
        DELETE FROM yara_rules 
        WHERE alert_id NOT IN (SELECT id FROM alerts)
    `);
    // SQLite run returns { changes: number }
    if (orphansRules && orphansRules.changes) {
        stats.rulesRemoved = orphansRules.changes;
    } else {
        // Fallback if driver doesn't return changes directly, standard sqlite3 does though.
        // Let's assume standard behavior or manual count if needed.
        // For safer counting if run() result is vague:
        // But assuming sqlite3's 'this.changes' style from wrapper.
        // If db.run returns a result object with changes property:
        stats.rulesRemoved += orphansRules.changes || 0;
    }

    // 3. Remove orphaned MITRE mappings
    const orphanMappings = await db.run(`
        DELETE FROM alert_mitre_mappings 
        WHERE alert_id NOT IN (SELECT id FROM alerts)
    `);
    if (orphanMappings && orphanMappings.changes) {
        stats.mappingsRemoved += orphanMappings.changes || 0;
    }

    console.log('Deduplication stats:', stats);
    return stats;
}

module.exports = removeDuplicates;
