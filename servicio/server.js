const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');

const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const consultas = require('./consultas');

const app = express();
const PORT = process.env.PORT || 2711;
const allowedOrigins = process.env.ORIGENES;
const MAILHOST = process.env.MAILHOST;
const MAILUSER = process.env.MAILUSER;
const MAILPORT = process.env.MAILPORT;
const MAILFROM = process.env.MAILFROM;
const MAILPASSWORD = process.env.MAILPASSWORD;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ORGA = process.env.ORGA;


var clientes = {};
var menuNodes = {};

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', true);

// Middleware para validar la Cookie HttpOnly de sesión
const verificarAutenticacion = (req, res, next) => {
    const sessionCookie = req.cookies.auth_session;

    if (sessionCookie === 'usuario_autenticado') {
        return next();
    }
    res.redirect('/');
};


const numeroAEmoji = {
    "0": "0️⃣",
    "1": "1️⃣",
    "2": "2️⃣",
    "3": "3️⃣",
    "4": "4️⃣",
    "5": "5️⃣",
    "6": "6️⃣",
    "7": "7️⃣",
    "8": "8️⃣",
    "9": "9️⃣"
};

function convertirANumerosEmoji(numero) {
    const str = numero.toString();
    let resultado = "";
    for (const digito of str) {
        resultado += numeroAEmoji[digito] || digito;
    }
    return resultado;
}

// API: Login
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.PAGE_PASSWORD) {
        res.cookie('auth_session', 'usuario_autenticado', {
            httpOnly: true,
            secure: true, // Crucial ya que estás usando HTTPS obligado por IIS
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60 * 3 // 3 horas de sesión
        });
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false, message: 'Clave incorrecta' });
});

// API: Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('auth_session');
    return res.json({ success: true });
});

// CARPETA ESTÁTICA PROTEGIDA: Solo accesible si pasa el middleware de autenticación
app.use('/private', verificarAutenticacion, express.static(path.join(__dirname, 'private_views')));

const VERIFY_TOKEN = 'webHookMarceloIms011Bipoint'; // 👈 Guárdalo en variables de entorno
app.get('/api/webhook', (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ Webhook verificado por Meta');
            console.log('Challenge' + String(challenge));
            // ✅ Enviar el challenge como texto plano (sin JSON)
            res.status(200).send(String(challenge));
        } else {
            console.log('❌ Verificación fallida');
            console.log('   - mode esperado: "subscribe", recibido:', mode);
            console.log('   - token esperado:', VERIFY_TOKEN, ', recibido:', token);
            res.sendStatus(403);
        }
    }
    catch (e) {
        console.log(e);
    }
});
/*
body.entry[0].changes[0].value.messages[0].interactive.list_reply.id
  title
*/

//body.entry[0].changes[0].value.messages[0].interactive.list_reply
app.post('/api/webhook', async (req, res) => {
    var telefono = "";
    var nome = "";
    try {


        const entries = req.body.entry || [];

        for (const entry of entries) {
            const changes = entry.changes || [];

            for (const change of changes) {

                // Solo procesamos mensajes del usuario
                if (!change.value.messages) continue;

                const messages = change.value.messages;

                for (const msg of messages) {
                    const userResponse = getUserMessage(msg);
                    console.log("Respuesta del usuario:", userResponse);
                    res.sendStatus(200);
                    // Aquí procesas tu lógica de bot
                    llego = req.body;
                    var phoneNumber = llego.entry[0].changes[0].value.contacts[0].wa_id;

                    var nombre = llego.entry[0].changes[0].value.contacts[0].profile.name;

                    if (!clientes[phoneNumber]) {
                        await updateCliente(false, phoneNumber, nombre, menuNodes["0"].tipo, menuNodes['0'], null);
                        await sendWhatsappMessage(phoneNumber, 'texto', "🙋‍♂️ Bienvenido/a " + nombre, getNodo('0'));
                        enviar(phoneNumber, menuNodes['0'])
                    }
                    else {
                        var nodoEnviado = clientes[phoneNumber].nodoEnviado;
                        console.log('nodo enviado', nodoEnviado.tipo);
                        switch (nodoEnviado.tipo) {
                            case "ver-lista":
                                let respuesta = traeHijos(nodoEnviado.id, userResponse);
                                if (respuesta == null) {
                                    await sendWhatsappMessage(phoneNumber, 'texto', 'Opcion Incorrecta\nIntente nuevamente');
                                }
                                else {
                                    clientes[phoneNumber].estado = respuesta.tipo;
                                    clientes[phoneNumber].viendoid = respuesta.id;

                                    await sendWhatsappMessage(phoneNumber, respuesta.tipo, "", menuNodes[respuesta.id]);
                                }

                                break;
                            case "ver-interactivo":
                                break;
                            case "ver-texto-lista":
                                break;
                        }
                    }
                }
            }
        }



        return;
        const body = req.body;

        var phoneNumber; var nombre; var timestamp; var mensaje;
        res.status(200).send('WebHook Procesado');
        if ('statuses' in body.entry[0].changes[0].value) {
            if (
                body.entry[0].changes[0].value.statuses[0].status == 'sent' ||
                body.entry[0].changes[0].value.statuses[0].status == 'read') {
                return;
            }
        }
        else {
            phoneNumber = body.entry[0].changes[0].value.contacts[0].wa_id;
            nombre = body.entry[0].changes[0].value.contacts[0].profile.name;
            if (!clientes[phoneNumber]) {
                await updateCliente(false, phoneNumber, nombre, menuNodes["0"].tipo, "0");
                clientes[phoneNumber].anterior = '0';
                await sendWhatsappMessage(phoneNumber, 'texto', "🙋‍♂️ Bienvenido/a " + nombre, getNodo('0'));

                switch (menuNodes["0"].tipo) {
                    case 'ver-submenues-interactivo':
                        enviarLista("0", phoneNumber);
                        break;
                    case "ver-lista":
                        const texto = generarListaMenu(menuNodes['0']);
                        clientes[phoneNumber].estado = 'ver-lista';
                        clientes[phoneNumber].viendoid = '0';
                        sendWhatsappMessage(phoneNumber, 'texto', texto, getNodo('0'));

                }
            }
            else {
                let cliac = clientes[phoneNumber];

                let respondio;

                switch (cliac.estado) {
                    case 'ver-lista':
                        let padre = cliac.viendoid;
                        respondio = body.entry[0].changes[0].value.messages[0].text.body;

                        let respuesta = traeHijos(cliac.viendoid, respondio);
                        if (respuesta == null) {
                            await sendWhatsappMessage(phoneNumber, 'texto', 'Opcion Incorrecta\nIntente nuevamente');
                        }
                        else {
                            clientes[phoneNumber].estado = respuesta.tipo;
                            clientes[phoneNumber].viendoid = respuesta.id;

                            await sendWhatsappMessage(phoneNumber, respuesta.tipo, "", menuNodes[respuesta.id]);
                        }

                        break;
                    case "ver-interactivo":
                        respondio = body.entry[0].changes[0].value.messages[0].interactive.list_reply;
                        if (respondio.id == '0') {
                            await sendWhatsappMessage(phoneNumber, getNodo(clientes[phoneNumber].anterior)[0].tipo, '', getNodo(clientes[phoneNumber].anterior));
                            return;
                        }

                        nodos = menuNodes.filter(function (x) { return x.id == respondio.id });
                        switch (nodos[0].tipo) {
                            case "ver-texto-lista":
                                let nodoTipo = nodos.filter(item => item.param == 'tipo')[0].valor;
                                switch (nodoTipo) {
                                    case 'query':
                                        let nodoQuery = nodos.filter(item => item.param == nodoTipo)[0].valor
                                        let resultado = await consulta(nodoQuery, 'array');
                                        let configuracion = nodos.filter(function (x) { return x.param == 'tabla' })[0].valor;
                                        resultado = await getTabla(resultado, configuracion);
                                        await sendWhatsappMessage(phoneNumber, 'texto', resultado, respondio.title);

                                        break;
                                }

                                let x = 0

                                break;
                            case "ver-texto-lista":
                                let a = 1;
                                break;
                        }
                }



            }
        }
    }
    catch (e) {
        console.log(e);
    }
});

async function enviar(phoneNumber, nodo) {
    switch (nodo.tipo) {
        case 'ver-interactivo':
            enviarLista(nodo.id, phoneNumber);
            break;
        case "ver-lista":
            const texto = generarListaMenu(nodo);
            await sendWhatsappMessage(phoneNumber, 'texto', texto, getNodo('0'));
            break;
        case "ver-texto-lista":
            break;
    }

}

function getNodo(id) {
    return menuNodes.filter(item => item.id == id)[0];
}
function getUserMessage(message) {
    switch (message.type) {
        case "text":
            return message.text.body;

        case "interactive":
            if (message.interactive.type === "button_reply") {
                return message.interactive.button_reply.title;
            }
            if (message.interactive.type === "list_reply") {
                return message.interactive.list_reply.title;
            }
            return null;

        case "image":
            return "<imagen recibida>";
        case "document":
            return "<documento recibido>";
        // Agrega más tipos si los necesitas
        default:
            return null;
    }
}

async function getTabla(r, config) {
    let retu = "";
    try {
        let c = config.split("|")[1].split(";");
        let orientacion = config.split("|")[3];
        let controlLinea = config.split("|")[5];

        const condFn = new Function('r', 'i', `return ${controlLinea};`);

        for (var i = 0; i < r.length; i++) {
            retu += "✅"
            for (var j = 0; j < c.length; j++) {
                if (j == 2) {
                    if (condFn(r, i)) {
                        retu += c[j] + ":" + r[i][j] + "\n";
                    }
                    else {
                        retu += "❌Sin Stock\n";
                    }
                }
                else {
                    retu += c[j] + ":" + r[i][j] + "\n";
                }
            }
            retu += "........................................\n";
        }
    }
    catch (e) { console.log(e) }
    finally {
        retu += "     *_0 para volver Atras_*";
        return retu;
    }
}

function traeHijos(id, orden) {
    let Hijos = Object.values(menuNodes).filter(item =>
        item.padre == id &&
        item.param == "label"
    );
    if (!Number.isInteger(Number(orden)) ||
        parseInt(orden) > Hijos.length) {
        return null;
    }
    else {
        return Hijos[orden - 1];
    }
}
function generarListaMenu(nodo) {
    var retu = "";
    try {
        retu = nodo.titulo + "\n----------------------------------------\n";
        let listaHijos = Object.values(menuNodes).filter(item =>
            item.padre == nodo.id &&
            item.param == "label"
        );
        listaHijos = listaHijos.sort((a, b) => a.orden - b.orden);
        for (var i = 0; i < listaHijos.length; i++) {
            retu += convertirANumerosEmoji(i + 1) + " " + listaHijos[i].valor + "\n"
        }
        if (nodo.id != '0') retu += "\n" + convertirANumerosEmoji(0) + "  para Volver Atras";

    }
    catch (e) { console.log(e) }
    finally {
        return retu;
    }
}
async function generarOpciones(padreId) {
    var retu = [];
    try {
        menuPadre = menuNodes[padreId];
        const listaNodos = Object.values(menuNodes).filter(item =>
            item.padre == padreId &&
            item.param == "label"
        );

        for (var i = 0; i < listaNodos.length; i++) {
            let titleStr = "✔️ " + listaNodos[i].valor;

            if (titleStr.length > 24) {
                titleStr = titleStr.substring(0, 24);
            }

            let op = { id: listaNodos[i].id, title: titleStr };

            retu.push(op);
        }
        let op = { id: "0", title: "❌ Volver atras" };
        retu.push(op);
    }
    catch (e) { console.log(e) }
    finally {
        return retu;
    }
}

function bodyInteractivo(phoneNumber, mensaje, opciones) {
    // opciones = [{ id: 1, title: 'aaa' }, { id: 2, title: 'ttt' }];

    const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: mensaje
            },
            body: {
                text: "Tocar Ver Opciones"
            },
            footer: {
                text: ""
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
    return body;

}
/*
                            { id: "express", title: "Express 24h", description: "Entrega en 1 día" },
                            { id: "standard", title: "Standard 2-3 días", description: "Entrega en 2 a 3 días" }
                     ]
                        */

async function sendWhatsappMessage(phoneNumber, tipo, mensaje, nodo) {
    clientes[phoneNumber].nodoEnviado = nodo;
    var body
    const cleanPhone = phoneNumber.toString().replace(/[\s+\-()]/g, '').trim();
    if (!/^\d{10,15}$/.test(cleanPhone)) {
        throw new Error(`Número inválido: ${cleanPhone}`);
    };
    switch (tipo) {
        case 'texto':
            body = {
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: {
                    body: mensaje
                }
            };
            break;
        case 'ver-interactivo':
            let opciones = await generarOpciones(nodo.id);
            body = bodyInteractivo(cleanPhone, nodo.titulo, opciones);
            break;
        case 'ver-lista':
            clientes[phoneNumber].estado = 'ver-lista';
            body = {
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: {
                    body: generarListaMenu(menuNodes[nodo[0].id])
                }
            };
            break;
    }
    const response = await fetch(
        `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );

    const data = await response.json();
    return data;
}



app.get('/api/test', (req, res) => {
    try {
        res.status(200).send('Comunicaciones  Test OK');
    }
    catch (e) {
        console.log(e);
    }
});

async function cargarClientes() {

    try {

        const items = await consultas.obtenerClientes(ORGA);
        clientes = {};

        items.forEach(item => {
            clientes[item.telefono] = item;
        });

        console.log('Clientes cargados');

    } catch (error) {

        console.error(
            'Error cargando clientes:',
            error
        );

        clientes = {};
    }
}
async function consulta(query, tipo) {
    try {
        const resultado = await consultas.consulta(query, tipo);
        if (resultado == null) {
            return [];
        }
        return resultado;
    }
    catch (error) {
        console.error("Error al obtener el menú desde PostgreSQL:", error);
        return [];
    }
}
async function cargarMenu() {
    try {
        const items = await consultas.obtenerMenuPrincipal(ORGA);
        menuNodes = [];

        items.forEach(item => {
            menuNodes.push(item);
        });

        console.log(`📋 Menú cargado desde PostgreSQL (${Object.keys(menuNodes).length} opciones)`);
    } catch (err) {
        console.error('Error cargando menú desde BD:', err.message);
    }
}

async function generarTextoMenu(phoneNumber, padreId, preMensaje) {
    try {

        let texto = preMensaje + "\n";

        menuPadre = menuNodes[padreId];
        let listaNodos = Object.values(menuNodes).filter(
            item => item.orga = ORGA &&
                item.padre == padreId &&
                item.param == 'label');


        for (var i = 0; i < listaNodos.length; i++) {
            const numIcon = convertirANumerosEmoji(i + 1); //idx < 10 ? numeros[idx] : `${idx + 1}.`;
            texto += numIcon + " " + listaNodos[i].valor + "\n";
        }
        texto += convertirANumerosEmoji(0) + "  para Volver atras ❌";
        let respuesta = await sendWhatsappMessage(
            phoneNumber.toString(),
            texto, "", "", "", "texto", "");
    }

    catch (e) {
        return "";
    }
}
/*
{
                        title: "Entrega rápida",
                        rows: [
                            { id: "express", title: "Express 24h", description: "Entrega en 1 día" },
                            { id: "standard", title: "Standard 2-3 días", description: "Entrega en 2 a 3 días" }
                        ]
                    }
                        /*
 
 
/*function generarTextoMenu(nodoId, preMensaje, accion , clienteActual) {
    const node = menuNodes[nodoId];
    let text = preMensaje + "\n";//+ node.label + "\n\n";
 
    var idx = 0;
    node.children.forEach((child) => {
        idx++
        const numIcon = convertirANumerosEmoji(idx); //idx < 10 ? numeros[idx] : `${ idx + 1 }.`;
        const accion = child.accion;
        if (accion != "" && accion != "menu" && accion != "ver") {
            switch (accion.split("-")[0]) {
                case "input":
                    switch (child.accion.split("-")[1]) {
                        case "email":
                            text += "Ingresa un e-Mail valido para el envio";
                            clienteActual.estado = 'mando-e-mail';
                            return text;
                            break;
                    }
 
 
            }
        }
        else { text += `${ numIcon } ${ child.label } \n` }
    });
 
    text += '\n_Respondé con el número de tu elección_';
    if (nodoId !== 'root') {
        text += '\n_Escribí *0* para volver atrás._';
    }
 
    return text;
}
*/
// ─── Estado global del bot ────────────────────────────────────────────────────
let botActivo = true;


async function updateCliente(grabarBD, numero, nombre, tipoEnviado, nodoEnviado, nodoAnterior) {
    const ahora = new Date();
    const utc3 = new Date(ahora.getTime() - (3 * 60 * 60 * 1000));
    const timestamp = utc3.getTime();

    if (!clientes[numero]) {
        clientes[numero] = {
            nombre: nombre,
            primercontacto: timestamp,
            total_mensajes: 1,
            ultimocontacto: timestamp,
            tipoEnviado: tipoEnviado,
            nodoEnviado: nodoEnviado,
            nodoAnterior: nodoAnterior
        };
    } else {
        // No actualizamos el nombre si ya existe
        clientes[numero].total_mensajes = (clientes[numero].total_mensajes || 0) + 1;
        clientes[numero].ultimocontacto = timestamp;
        clientes[numero].estado = estado;
        clientes[numero].proximo = valProximo;
    }

    if (grabarBD) {
        try {
            await consultas.updateCliente(ORGA, numero.toString(), nombre, estado, valProximo);
        } catch (err) {
            console.error("Error al actualizar cliente en PostgreSQL:", err);
        }
    }
}


function convertirANumerosEmoji(numero) {
    // convertir a string por si es number
    const str = numero.toString();

    // reemplazar cada dígito por su emoji
    let resultado = "";
    for (const digito of str) {
        resultado += numeroAEmoji[digito] || digito; // si no es dígito lo deja igual
    }
    return resultado;
}

function getChildrenById(id) {
    let nodo = menuNodes[id];
    if (!nodo.children) return [];
    var retu = [];
    for (var i = 0; i < nodo.children.length; i++) {
        retu.push({
            "id": nodo.children[i].id,
            "accion": nodo.children[i].accion
        })

    }
    return retu; // si no se encuentra el id
}

function ancestro(str) {
    const partes = str.split('-');
    partes.pop();
    return partes.join('-');
}

const { poolPromise } = require('./db');
const { title } = require('process');

app.listen(PORT, '0.0.0.0', () => {
    console.log('Node API escuchando en http://localhost:' + PORT);

    // Test de conexión a la base de datos
    poolPromise.then(pool => {
        pool.request().query('SELECT NOW() AS "currentTime"').then(result => {
            console.log('✅ Test de conexión a Base de Datos PostgreSQL exitoso. Hora actual DB:', result.recordset[0].currentTime);
        }).catch(err => {
            console.error('❌ Error ejecutando consulta de prueba en la Base de Datos:', err);
        });
    }).catch(err => {
        console.error('❌ Error al inicializar la conexión a la Base de Datos:', err);
    });
});

cargarMenu();
cargarClientes();


