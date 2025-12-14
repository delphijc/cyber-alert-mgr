async function removeDuplicates(db) {
    console.log('Running deduplication...');
    const stats = {
        alertsRemoved: 0,
        rulesRemoved: 0,
        mappingsRemoved: 0
    };

    // 1. Deduplicate Alerts based on external_id
    try {
        console.log('Scanning for duplicate alerts (by external_id)...');
        const duplicates = await db.all(`
            SELECT external_id, COUNT(*) as count 
            FROM alerts 
            GROUP BY external_id 
            HAVING count > 1
        `);
        console.log(`Found ${duplicates.length} sets of duplicates.`);

        // Collect all IDs to delete in one go
        let idsToDelete = [];

        for (const dup of duplicates) {
            console.log(`Processing duplicate set for external_id: ${dup.external_id} (${dup.count} entries)`);
            const entries = await db.all(`
                SELECT id, title, published_date 
                FROM alerts 
                WHERE external_id = ? 
                ORDER BY published_date DESC, id DESC
            `, [dup.external_id]);

            if (entries.length > 0) {
                const kept = entries[0];
                console.log(`  Keeping latest: [${kept.id}] "${kept.title}" (${kept.published_date})`);

                // Keep index 0, delete the rest
                const toRemove = entries.slice(1);
                if (toRemove.length > 0) {
                    console.log(`  Marking for deletion:`);
                    toRemove.forEach(r => console.log(`    - [${r.id}] "${r.title}" (${r.published_date})`));
                    idsToDelete.push(...toRemove.map(e => e.id));
                }
            }
        }

        if (idsToDelete.length > 0) {
            console.log(`Executing batch delete for ${idsToDelete.length} alerts...`);
            // SQLite limit for variables is usually high (999 or 32k), but let's batch if huge. 
            // For now, simple IN clause.
            const placeholders = idsToDelete.map(() => '?').join(',');
            const result = await db.run(`DELETE FROM alerts WHERE id IN (${placeholders})`, idsToDelete);
            stats.alertsRemoved = result.changes || 0;
            console.log(`Successfully removed ${stats.alertsRemoved} duplicate alerts.`);
        } else {
            console.log('No duplicate alerts to remove.');
        }
    } catch (err) {
        console.error('Error removing duplicate alerts:', err);
    }

    // 2. Remove orphaned YARA rules
    try {
        console.log('Scanning for orphaned YARA rules...');
        const result = await db.run(`DELETE FROM yara_rules WHERE alert_id NOT IN (SELECT id FROM alerts)`);
        stats.rulesRemoved = result.changes || 0;
        if (stats.rulesRemoved > 0) console.log(`Removed ${stats.rulesRemoved} orphaned YARA rules.`);
    } catch (err) {
        console.error('Error removing orphaned rules:', err);
    }

    // 3. Remove orphaned MITRE mappings
    try {
        console.log('Scanning for orphaned MITRE mappings...');
        const result = await db.run(`DELETE FROM alert_mitre_mappings WHERE alert_id NOT IN (SELECT id FROM alerts)`);
        stats.mappingsRemoved = result.changes || 0;
        if (stats.mappingsRemoved > 0) console.log(`Removed ${stats.mappingsRemoved} orphaned MITRE mappings.`);
    } catch (err) {
        console.error('Error removing orphaned mappings:', err);
    }

    console.log('Deduplication finished. Stats:', stats);
    return stats;


}

module.exports = removeDuplicates;
