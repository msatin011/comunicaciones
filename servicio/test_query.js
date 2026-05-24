const { poolPromise } = require('./db');

async function test() {
    try {
        const pool = await poolPromise;
        const res = await pool.request().query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'menu' OR table_name = 'menu_det'
        `);
        console.log("Columns:", res.recordset);

        const res2 = await pool.request().query(`
            select m.id,d.valor from menu m join menu_det d on m.id=d.id and m.orga=d.orga
            where m.orga=10 and m.padre ='' and d.ver = true
            order by  d.orden 
        `);
        console.log("User query items:", res2.recordset);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
