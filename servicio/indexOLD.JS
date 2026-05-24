const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');

const nodemailer = require('nodemailer');
const cors = require('cors');
const https = require('https');
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
const CLIENTES_FILE = path.join(__dirname, process.env.CLIENTES_FILE);

var clientes = {};
var estados = {};
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

const MENU_FILE = path.join(__dirname, 'menu.json');
const MENU_DETALLES = path.join(__dirname, 'menu_detalles.json');
const detalles = JSON.parse(fs.readFileSync(MENU_DETALLES, 'utf8'));


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

app.post('/api/webhook', async (req, res) => {
    var telefono = "";
    var nome = "";
    try {
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
            let responder;

            if (!clientes[phoneNumber]) {
                actualizarCliente(phoneNumber, nombre, "1");
                responder = await generarTextoMenu('1', "Bienvenido " + nombre + "\n", 'menu');
                let respuesta = await sendWhatsappMessage(phoneNumber.toString(), responder);
                clientes[phoneNumber].continua = getChildrenById('1');
                clientes[phoneNumber].anterior = '1'
                return;
            }
            else {
                let cliac = clientes[phoneNumber];
                var msg = body.entry[0].changes[0].value.messages[0].text.body;
                if (/^[1-9]\d*$/.test(msg) && cliac.continua.length != 0);
                if (msg == '0') {
                    responder = await generarTextoMenu(cliac.continua, '', 'menu');
                    //cliac.continua = ancestro(cliac.continua);
                    await sendWhatsappMessage(phoneNumber.toString(), responder);
                    return;
                }
                if (cliac.continua[Number(msg) - 1]) {
                    let opactual = cliac.continua[Number(msg) - 1];
                    clientes[phoneNumber].continua = getChildrenById(opactual.id);
                    switch (opactual.accion) {
                        case 'menu':
                            responder = await generarTextoMenu(opactual.id, '', 'menu');
                            await sendWhatsappMessage(phoneNumber.toString(), responder);
                            break;
                        case "ver":
                            verArray = detalles.find(item => item.ver).ver
                            clientes[phoneNumber].continua = ancestro(opactual.id);
                            responder = "";
                            for (var i = 0; i < verArray.length; i++)
                                responder += menuNodes[opactual.id][verArray[i]] + "\n"
                            await sendWhatsappMessage(phoneNumber.toString(), responder);

                            break;
                    }
                }
                else {
                    responder = await generarTextoMenu(clientes[phoneNumber].anterior, "Opcion Incorrecta\n", 'menu');
                    let respuesta = await sendWhatsappMessage(phoneNumber.toString(), responder);

                }
                return;

            }
            var msg = body.entry[0].changes[0].value.messages[0].text.body;
            const currentEstado = clientes[phoneNumber] ? clientes[phoneNumber].estado || "" : "";
            const estadoNodo = currentEstado === "" ? 'root' : currentEstado;
            const nodoActual = menuNodes[estadoNodo] || menuNodes['root'];

            actualizarCliente(phoneNumber, nombre, currentEstado);

            const total_mensajes = clientes[phoneNumber].total_mensajes;
            let otra = '';
            if (total_mensajes != "1") otra = 'Nuevamente';

            const opcion = msg.trim();
            var accion = nodoActual.accion;
            if (opcion === '0') {
                const parentId = nodoActual.parentId || 'root';
                const nuevoEstado = parentId === 'root' ? '' : parentId;
                actualizarCliente(phoneNumber, nombre, nuevoEstado);
                guardarClientes();
                responder = generarTextoMenu(parentId, "Volviendo atrás\n", '');
            } else if (/^[1-9]\d*$/.test(opcion) && nodoActual.children) {
                const index = parseInt(opcion, 10) - 1;
                const selectedChild = nodoActual.children[index];

                if (selectedChild) {
                    const nuevoEstado = selectedChild.id;
                    actualizarCliente(phoneNumber, nombre, nuevoEstado);
                    guardarClientes();

                    if (selectedChild.accion === 'menu' && selectedChild.children) {
                        responder = generarTextoMenu(selectedChild.id, "Elegiste: " + selectedChild.label + "\n", accion, clientes[phoneNumber]);
                    } else {
                        responder = `Elegiste: ${selectedChild.label}`;
                        if (selectedChild.Precio) {
                            responder += `\nPrecio: ${selectedChild.Precio}`;
                        }
                        responder += `\n\n_Escribí *0* para volver atrás._`;
                    }
                } else {
                    responder = generarTextoMenu(estadoNodo, "Opción inválida, elegí un número válido.\n", '');
                }
            } else {
                if (estadoNodo === 'root') {
                    responder = generarTextoMenu('root', "Bienvenido " + otra + " " + nombre + "\n", '');
                } else {
                    switch (estadoNodo) {
                        case "mando-e-mail":
                            console.log(msg);
                            responder = "Se envio un e-mail a : " + msg;
                            break;
                        default:
                            responder = generarTextoMenu(estadoNodo, "No entendí tu respuesta. Elegí una opción de la lista.\n", '');
                            break;
                    }

                }
            }

            let respuesta = await sendWhatsappMessage(phoneNumber.toString(), responder);
            console.log(respuesta, null, 2);
        }
    }
    catch (e) {
        console.log(e);
    }
});

app.get('/api/test', (req, res) => {
    try {
        res.status(200).send('Comunicaciones  Test OK');
    }
    catch (e) {
        console.log(e);
    }
});

function cargarClientes() {

    try {

        // si el archivo no existe
        if (!fs.existsSync(CLIENTES_FILE)) {

            clientes = {};

            console.log(
                'Archivo clientes no existe, creado vacío'
            );

            return;
        }

        const data = fs.readFileSync(
            CLIENTES_FILE,
            'utf8'
        );

        clientes = JSON.parse(data);

        console.log('Clientes cargados');

    } catch (error) {

        console.error(
            'Error cargando clientes:',
            error
        );

        clientes = {};
    }
}

function guardarClientes() {

    try {

        fs.writeFileSync(
            CLIENTES_FILE,
            JSON.stringify(clientes, null, 4),
            'utf8'
        );

        console.log('Clientes guardados');

    } catch (error) {

        console.error(
            'Error guardando clientes:',
            error
        );
    }
}


// Fecha y hora en GMT-3
function fechaArgentina() {
    return new Date().toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}





async function sendWhatsappMessage(phoneNumber, mensaje) {
    const cleanPhone = phoneNumber.toString().replace(/[\s+\-()]/g, '').trim();
    if (!/^\d{10,15}$/.test(cleanPhone)) {
        throw new Error(`Número inválido: ${cleanPhone}`);
    };
    const xbody = {
        messaging_product: 'whatsapp',
        to: String(phoneNumber),
        type: 'text',
        text: {
            body: mensaje
        }
    };

    const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "5491136485978",
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "Opciones de envío"
            },
            body: {
                text: "Elige la opción que prefieras:"
            },
            footer: {
                text: "Tu tienda favorita 🌿"
            },
            action: {
                button: "Ver opciones",
                sections: [
                    {
                        title: "Entrega rápida",
                        rows: [
                            { id: "express", title: "Express 24h", description: "Entrega en 1 día" },
                            { id: "standard", title: "Standard 2-3 días", description: "Entrega en 2 a 3 días" }
                        ]
                    },
                    {
                        title: "Entrega económica",
                        rows: [
                            { id: "ground", title: "Ground", description: "Entrega en 4-6 días" },
                            { id: "pickup", title: "Retiro en tienda", description: "Puedes retirar en la sucursal" }
                        ]
                    }
                ]
            }
        }
    };


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



async function cargarMenu() {
    try {
        const items = await consultas.obtenerMenuPrincipal();
        menuNodes = {};

        items.forEach(item => {
            menuNodes[item.id] = item;
        });

        console.log(`📋 Menú cargado desde PostgreSQL (${Object.keys(menuNodes).length} opciones)`);
    } catch (err) {
        console.error('Error cargando menú desde BD:', err.message);
    }
}

function generarTextoMenu(nodoId, preMensaje, accion, clienteActual) {
    const node = menuNodes[nodoId];
    let text = preMensaje + "\n";//+ node.label + "\n\n";

    if (accion == 'menu') {
        var idx = 0;
        node.children.forEach((child) => {
            idx++
            const numIcon = convertirANumerosEmoji(idx);
            text += `${numIcon} ${child.label}\n`
        });

        text += '\n_Respondé con el número de tu elección_';
        if (nodoId !== '1') {
            text += '\n_Escribí *0* para volver atrás._';
        }

        return text;
    }
}

/*function generarTextoMenu(nodoId, preMensaje, accion , clienteActual) {
    const node = menuNodes[nodoId];
    let text = preMensaje + "\n";//+ node.label + "\n\n";
 
    var idx = 0;
    node.children.forEach((child) => {
        idx++
        const numIcon = convertirANumerosEmoji(idx); //idx < 10 ? numeros[idx] : `${idx + 1}.`;
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
        else { text += `${numIcon} ${child.label}\n` }
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


function actualizarCliente(numero, nombre, estado) {
    const ahora = new Date();
    const utc3 = new Date(
        ahora.getTime() - (3 * 60 * 60 * 1000)
    );
    const timestamp = utc3.getTime();
    if (!clientes[numero]) {

        clientes[numero] = {
            nombre: nombre,
            primer_contacto: timestamp,
            total_mensajes: 1,
            ultimo_mensaje: timestamp,
            estado: estado,
            proximo: 0
        };

    } else {
        clientes[numero].nombre = nombre;
        clientes[numero].total_mensajes += 1;
        clientes[numero].ultimo_mensaje = timestamp;
        clientes[numero].estado = estado
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


