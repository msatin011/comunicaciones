const { poolPromise } = require('./db');

async function test() {
    try {
        const pool = await poolPromise;
        const res = await pool.request().query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'cliente' AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
        `);
        console.log("Constraints:", res.recordset);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
