async function removeDuplicates(db) {
    console.log('Running deduplication...');
    const stats = {
        alertsRemoved: 0,
        rulesRemoved: 0,
        mappingsRemoved: 0
    };

    // 1. Deduplicate Alerts based on external_id
    try {
        const duplicates = await db.all(`
            SELECT external_id, COUNT(*) as count 
            FROM alerts 
            GROUP BY external_id 
            HAVING count > 1
        `);

        // Collect all IDs to delete in one go
        let idsToDelete = [];

        for (const dup of duplicates) {
            const entries = await db.all(`
                SELECT id 
                FROM alerts 
                WHERE external_id = ? 
                ORDER BY published_date DESC, id DESC
            `, [dup.external_id]);

            // Keep index 0, delete the rest
            const toRemove = entries.slice(1).map(e => e.id);
            idsToDelete.push(...toRemove);
        }

        if (idsToDelete.length > 0) {
            console.log(`Deleting ${idsToDelete.length} duplicate alerts...`);
            // SQLite limit for variables is usually high (999 or 32k), but let's batch if huge. 
            // For now, simple IN clause.
            const placeholders = idsToDelete.map(() => '?').join(',');
            const result = await db.run(`DELETE FROM alerts WHERE id IN (${placeholders})`, idsToDelete);
            stats.alertsRemoved = result.changes || 0;
        }
    } catch (err) {
        console.error('Error removing duplicate alerts:', err);
    }

    // 2. Remove orphaned YARA rules
    try {
        const result = await db.run(`DELETE FROM yara_rules WHERE alert_id NOT IN (SELECT id FROM alerts)`);
        stats.rulesRemoved = result.changes || 0;
    } catch (err) {
        console.error('Error removing orphaned rules:', err);
    }

    // 3. Remove orphaned MITRE mappings
    try {
        const result = await db.run(`DELETE FROM alert_mitre_mappings WHERE alert_id NOT IN (SELECT id FROM alerts)`);
        stats.mappingsRemoved = result.changes || 0;
    } catch (err) {
        console.error('Error removing orphaned mappings:', err);
    }

    console.log('Deduplication stats:', stats);
    return stats;


}

module.exports = removeDuplicates;
