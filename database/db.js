// Inicializamos mysql2
const mysql2 = require('mysql2');

// Creamos la conexión a la base de datos

const db = mysql2.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

// Abre la conexión a la base de datos

db.connect((error) => {
    if (error){
        console.log('Error al conectar a la base de datos: ', error);
    }
    console.log('Conectado a la base de datos');
});

// Exportar la conexión a la base de datos

module.exports = db;