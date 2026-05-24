const { poolPromise } = require('./db');

async function test() {
    try {
        const pool = await poolPromise;
        const res = await pool.request().query(`
            select m.id, m.padre, d.param, d.valor, d.orden, d.ver,
            m.titulo1, m.titulo2 
            from menu m join menu_det d 
            on m.id=d.id and m.orga=d.orga
            where m.orga=10 and d.ver = true
            order by d.orden
        `);
        const rootItems = res.recordset;
        let menuNodes = {};
        rootItems.forEach(item => {
            menuNodes[item.id] = item;
        });

        let listaNodos = Object.values(menuNodes).filter(item => item.padre === "" && item.ver === true && item.param === "label");
        var opciones = [];
        for (var i = 0; i < listaNodos.length; i++) {
            // Omitting empty description to avoid validation errors, but we can print what it looks like
            opciones.push({ id: "opcion_" + String(i), title: listaNodos[i].valor, description: "" });
        }

        let menuPadre = Object.values(menuNodes).filter(item => item.id === "1");
        
        console.log("menuPadre[0]:", menuPadre[0]);
        console.log("opciones:", opciones);
        
        let titulo1 = menuPadre[0] ? menuPadre[0].titulo1 : undefined;
        let titulo2 = menuPadre[0] ? menuPadre[0].titulo2 : undefined;
        
        const body = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: "5491100000000",
            type: "interactive",
            interactive: {
                type: "list",
                header: {
                    type: "text",
                    text: "Bienvenido Nombre"
                },
                body: {
                    text: titulo1
                },
                footer: {
                    text: titulo2
                },
                action: {
                    button: "Ver opciones",
                    sections: [
                        {
                            "title": "Seleccionar",
                            "rows": opciones
                        }
                    ]
                }
            }
        };

        console.log("Body interactivo:", JSON.stringify(body, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
