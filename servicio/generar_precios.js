const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { poolPromise } = require('./db');

const categorias = [
  {
    rubro: 'Libreria',
    nombres: [
      'Cuaderno A4',
      'Bolígrafo Azul',
      'Marcador Permanente',
      'Resma de Papel',
      'Carpeta 3 anillos',
      'Corrector Líquido',
      'Regla 30 cm',
      'Lápiz Mecánico',
      'Tijera Escolar',
      'Goma de Borrar'
    ],
    precioMin: 450,
    precioMax: 14500,
    stockMin: 5,
    stockMax: 120
  },
  {
    rubro: 'Jugueteria',
    nombres: [
      'Auto a Fricción',
      'Muñeca de Tela',
      'Rompecabezas 500 Piezas',
      'Juego de Construcción',
      'Pelota Saltarina',
      'Figuras de Acción',
      'Bloques de Madera',
      'Peluches Suaves',
      'Kit de Pintura',
      'Cubo Mágico'
    ],
    precioMin: 1200,
    precioMax: 49500,
    stockMin: 2,
    stockMax: 80
  }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min, max) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(2));
}

function buildNombre(baseName, index) {
  const variantes = ['Edición', 'Plus', 'Premium', 'Kit', 'Compacto', 'Original', 'Familiar', 'Deluxe', 'Classic', 'Kids'];
  const variante = variantes[index % variantes.length];
  return `${baseName} ${variante}`;
}

async function insertarRegistros() {
  const pool = await poolPromise;
  const insertQuery = `
    INSERT INTO precio (rubro, nombre, precio, stock)
    VALUES (@rubro, @nombre, @precio, @stock)
  `;

  for (const categoria of categorias) {
    for (let i = 1; i <= 50; i++) {
      const baseName = categoria.nombres[(i - 1) % categoria.nombres.length];
      const nombre = buildNombre(baseName, i);
      const precio = randomPrice(categoria.precioMin, categoria.precioMax);
      const stock = randomInt(categoria.stockMin, categoria.stockMax);

      await pool.request()
        .input('rubro', categoria.rubro)
        .input('nombre', nombre)
        .input('precio', precio)
        .input('stock', stock)
        .query(insertQuery);

      console.log(`Insertado: ${categoria.rubro} - ${nombre} - $${precio} - stock ${stock}`);
    }
  }

  console.log('✅ 100 registros insertados en precio (50 Libreria + 50 Jugueteria).');
  process.exit(0);
}

insertarRegistros().catch(err => {
  console.error('Error insertando registros:', err);
  process.exit(1);
});
