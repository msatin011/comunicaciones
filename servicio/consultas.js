const { poolPromise } = require('./db');

async function obtenerMenuPrincipal(orga) {
    try {
        const pool = await poolPromise;
        const query = `
        SELECT m.id, m.padre, m.accion,d.param, d.valor, d.orden,
               m.header, m.titulo, m.footer, m.tipo
        FROM menu m 
        LEFT JOIN menu_det d ON m.id = d.id AND m.orga = d.orga
        WHERE m.orga = ${orga}
        ORDER BY m.id, d.param, d.orden
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error("Error al obtener el menú desde PostgreSQL:", error);
        throw error;
    }
}
async function consulta(query, tipo) {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(query);
        if (tipo == 'array') {
            return result.recordset.map(obj => Object.values(obj));
        }
        else {
            return result.recordset;

        }
    }
    catch (error) {
        console.error("Error al obtener el menú desde PostgreSQL:", error);
        throw error;
        return null;
    }
}

async function obtenerClientes(orga) {
    try {
        const pool = await poolPromise;
        const query = `
        select * from cliente where orga = ${orga} order by telefono
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error("Error al obtener clientes desde PostgreSQL:", error);
        throw error;
    }
}

async function updateCliente(orga, telefono, nombre, nodoactual, nodoanterior) {
    try {
        const pool = await poolPromise;
        const ahora = new Date();
        // Un timestamp en milisegundos (getTime) es absoluto y universal. 
        // No se debe restar 3 horas, porque eso genera una fecha de hace 3 horas.
        const timestamp = ahora.getTime();

        const checkQuery = `SELECT 1 FROM cliente WHERE orga = @orga AND telefono = @telefono`;
        const reqCheck = pool.request()
            .input('orga', orga)
            .input('telefono', telefono);

        const checkResult = await reqCheck.query(checkQuery);

        if (checkResult.recordset.length > 0) {
            // Si el registro existe, actualizamos
            const updateQuery = `
                UPDATE cliente 
                SET ultimocontacto = @ultimocontacto, nodoactual = @nodoactual,
                nodoanterior = @nodoanterior
                               WHERE orga = @orga AND telefono = @telefono
            `;
            await pool.request()
                .input('ultimocontacto', timestamp)
                .input('nodoanterior', nodoanterior)
                .input('nodoactual', nodoactual)
                .input('orga', orga)
                .input('telefono', telefono)
                .query(updateQuery);
        } else {
            // Si no existe, insertamos (el nombre solo se guarda al inicio)
            const insertQuery = `
                INSERT INTO cliente (orga, telefono, nombre, primercontacto, ultimocontacto, nodoactual, nodoanterior)
                VALUES (@orga, @telefono, @nombre, @primercontacto, @ultimocontacto, @nodoactual, @nodoanterior)
            `;
            await pool.request()
                .input('orga', orga)
                .input('telefono', telefono)
                .input('nombre', nombre)
                .input('primercontacto', timestamp)
                .input('ultimocontacto', timestamp)
                .input('nodoactual', "0")
                .input('nodoanterior', "0")
                .query(insertQuery);
        }
    } catch (error) {
        console.error("Error al actualizar cliente en PostgreSQL:", error);
        throw error;
    }
}
// Puedes ir agregando aquí otras consultas que necesites en el futuro
module.exports = {
    obtenerMenuPrincipal,
    obtenerClientes,
    updateCliente,
    consulta
};
