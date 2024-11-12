// Inicialización express
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path'); 

// Inicialización de la app 
// (la función express() crea una nueva instancia de un objeto express)
const app = express();

// Middleware para parsear los datos del request

app.use(express.urlencoded({extended: false}));
app.use(express.json());

// llamamos el archivo .env para gestionar variables de entorno

const dotenv = require('dotenv');
dotenv.config({path: './env/.env'})

//Configuracion del directorio public

app.use('/resources', express.static('public'));
app.use('/resources', express.static(__dirname + 'public'));

// Establecemos el motor de plantilla

app.set('view engine', 'ejs');

// Invocamos a bcryptjs

const bcryptjs = require('bcryptjs');

// Gestion de variables de inicio de sesion

const session = require ('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
}))

// para actualizar se requiere de :

const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// Llamamos la conexion a la base de datos

const db = require('./database/db');

//------------- creamos tablas a la base de datos -------------------

// Crear la tabla 'roles' si no existe
db.query(`
    CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rol VARCHAR(255) NOT NULL
    )
`, err => {
    if (err) throw err;
    console.log("Tabla 'roles' creada o verificada");
});

// Crear la tabla 'usuarios' si no existe
db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombres VARCHAR(255) NOT NULL,
        apellidos VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        telefono VARCHAR(20) NOT NULL,
        nickname VARCHAR(255) NOT NULL UNIQUE,
        contraseña VARCHAR(255) NULL,
        fecha_creacion DATE NOT NULL,
        rol_id INT NOT NULL,
        FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
`, err => {
    if (err) throw err;
    console.log("Tabla 'usuarios' creada o verificada");
});

// Crear la tabla 'cursos' si no existe
db.query(`
    CREATE TABLE IF NOT EXISTS cursos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre_curso VARCHAR(255) NOT NULL,
        URL_curso VARCHAR(255) NOT NULL,
        duracion VARCHAR(50) NOT NULL,
        valor INT NOT NULL,
        institucion VARCHAR(255) NOT NULL
    )
`, err => {
    if (err) throw err;
    console.log("Tabla 'cursos' creada o verificada");
});


// Crear la tabla 'calificaciones' si no existe
db.query(`
    CREATE TABLE IF NOT EXISTS calificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        id_curso INT NOT NULL,
        calificacion INT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
        detalles VARCHAR(255) NOT NULL,
        fecha DATE NOT NULL,
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (id_curso) REFERENCES cursos(id) ON DELETE CASCADE ON UPDATE CASCADE

    )
`, err => {
    if (err) throw err;
    console.log("Tabla 'calificaciones' creada o verificada");
});

// Insertar roles si no existen
db.query(`
    INSERT INTO roles (rol) 
    SELECT * FROM (SELECT 'admin') AS tmp 
    WHERE NOT EXISTS (
        SELECT rol FROM roles WHERE rol = 'admin'
    ) LIMIT 1;
`, err => {
    if (err) throw err;
    console.log("Rol 'admin' verificado o agregado");
});

db.query(`
    INSERT INTO roles (rol) 
    SELECT * FROM (SELECT 'usuario') AS tmp 
    WHERE NOT EXISTS (
        SELECT rol FROM roles WHERE rol = 'usuario'
    ) LIMIT 1;
`, err => {
    if (err) throw err;
    console.log("Rol 'usuario' verificado o agregado");
});

async function crearUsuarioAdmin() {
    try {
        let contrAdmin = '1234'; // Cambiado a string para evitar problemas con bcryptjs
        let pass = await bcryptjs.hash(contrAdmin, 8);

        const query = `
            INSERT INTO usuarios (nombres, apellidos, email, telefono, nickname, contraseña, fecha_creacion, rol_id)
            SELECT * FROM (SELECT 'administrador', 'eladmin', 'admin@admin.com', '1234567891', 'admin', 
                           ?, '2024-11-09', 1) AS tmp
            WHERE NOT EXISTS (
                SELECT nickname FROM usuarios WHERE nickname = 'admin'
            )
            LIMIT 1;
        `;

        db.query(query, [pass], (err) => {
            if (err) throw err;
            console.log("Usuario de admin creado exitosamente");
        });
    } catch (error) {
        console.error("Error creando el usuario admin:", error);
    }
}

crearUsuarioAdmin();

// ------------- creamos las vistas -------------

// Mostramos la ruta principal, esto muestra y conecta con index

app.get('/', (req, res) => {
    res.render('index');
});

// Mostramos la ruta de registro, esto muestra y conecta con registrar

app.get('/registrar', (req, res) => {
    res.render('registrar');
});


// ---------------Api para manejar el registro  ----------------------------------

//ruta de registro
app.post('/registrar', async (req, res) => {
    //console.log(req.body); //muestra los datos enviados en consola a traves de un JSON para confirmar valores
    const { nombres, apellidos, email, telefono, nickname, contraseña, fecha_creacion, rol_id } = req.body;
    let pass = await bcryptjs.hash(contraseña, 8); //encripta la contraseña y la guarda en pass la cual registramos en la bd 
    const sql = 'INSERT INTO usuarios (nombres, apellidos, email, telefono, nickname, contraseña, fecha_creacion, rol_id ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [nombres, apellidos, email, telefono, nickname, pass, fecha_creacion, rol_id], (error, result) => {
        if (error) {
            res.status(500).send('Error al crear usuario');
            return;
        }
        res.redirect('/');
    });
});


//---------- Api para inicio de sesión ----

// Ruta de autenticación
app.post('/index', async (req, res) => {
    const { email, contraseña } = req.body;
    const query = 'SELECT * FROM usuarios WHERE email = ?';  // Solo buscamos por email
    
    try {
        db.query(query, [email], async (error, results) => {
            if (error) {
                console.error('Error en la consulta:', error);
                res.status(500).send('Error interno en el servidor');
                return;
            }

            if (results.length > 0) {
                const usuario = results[0];
                
                // Comparar la contraseña ingresada con la hash almacenada
                const validPassword = await bcryptjs.compare(contraseña, usuario.contraseña);
                
                if (validPassword) {
                    const rol_id = usuario.rol_id;
                    
                    // Guardar el ID del usuario en la sesión
                    req.session.userId = usuario.id; 
                    req.session.rolId = rol_id;

                    if (rol_id === 1) {
                        res.redirect('/admin');
                    } else if (rol_id === 2) {
                        res.redirect('/perfil');
                    } else {
                        res.status(403).send('Rol no autorizado');
                    }
                } else {
                    res.status(401).send('Credenciales incorrectas');
                }
            } else {
                res.status(401).send('Credenciales incorrectas');
            }
        });
    } catch (error) {
        console.error('Error en la autenticación:', error);
        res.status(500).send('Error en el proceso de autenticación');
    }
});

// Middleware para verificar rol de administrador
const isAdmin = (req, res, next) => {
    if (!req.session.userId || req.session.rolId !== 1) {
        // Si no hay sesión o el rol no es admin (1)
        return res.redirect('/perfil');  // Redirige al perfil normal
    }
    next();
};

// Middleware para verificar usuario normal
const isUser = (req, res, next) => {
    if (!req.session.userId || req.session.rolId !== 2) {
        return res.redirect('/');
    }
    next();
};

// Aplicar el middleware a las rutas
app.get('/admin', isAdmin, (req, res) => {
    res.render('admin');
});

//------------ api de perfil   -------------- 
// Mostramos la ruta de perfil

app.get('/perfil', isUser, (req, res) => {
    const userId = req.session.userId;
    const query = `
        SELECT 
            u.id,
            u.nickname,
            c.id AS calificacion_id,
            c.calificacion,
            c.detalles,
            c.fecha,
            cr.nombre_curso
        FROM 
            usuarios u
        LEFT JOIN 
            calificaciones c ON u.id = c.id_usuario
        LEFT JOIN 
            cursos cr ON c.id_curso = cr.id
        WHERE 
            u.id = ?;`;
    
    db.query(query, [userId], (error, results) => {
        if (error) {
            console.error('Error al obtener datos del perfil:', error);
            return res.status(500).send('Error al cargar el perfil');
        }

        // Separar el usuario de las calificaciones
        const usuario = {
            id: results[0]?.id,
            nickname: results[0]?.nickname
        };
        const calificaciones = results.filter(row => row.calificacion_id !== null);

        res.render('perfil', { usuario, calificaciones });
    });
});

// Mostrar formulario de edición de una calificación específica
app.get('/editarOpinion/:id', isUser, (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM calificaciones WHERE id = ?';

    db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Error al obtener la calificación para editar:', error);
            return res.status(500).send('Error al cargar la calificación para editar');
        }
        if (results.length === 0) {
            return res.status(404).send('Calificación no encontrada');
        }
        res.render('editarOpinion', { calificacion: results[0] });
    });
});

// Actualizar calificación en la base de datos
app.put('/actuOpinion/:id', isUser, (req, res) => {
    const { calificacion, detalles, fecha } = req.body;
    const { id } = req.params;
    const query = 'UPDATE calificaciones SET calificacion = ?, detalles = ?, fecha = ? WHERE id = ?';

    db.query(query, [calificacion, detalles, fecha, id], (error, result) => {
        if (error) {
            console.error('Error al actualizar la calificación:', error);
            return res.status(500).send('Error al actualizar la calificación');
        }
        res.redirect('/perfil');
    });
});


// eliminacion de calificacion

app.get('/borrarOpinion/:id', isUser, (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM calificaciones WHERE id =?';
    db.query(query, [id], (error, result) => {
        if (error) {
            res.status(500).send('Error al eliminar la calificación');
            return;
        }
        // Redirigir al perfil después de eliminar la calificación
        res.redirect('/perfil');
    });
});

//-----------------api para cursos-----------------------------//

//traer informacion de cursos
app.get('/cursos', isUser, (req, res) => { 
    const userId = req.session.userId;
    
    // Consulta SQL para obtener todos los cursos
    const query = `
        SELECT * FROM cursos;
    `;
    db.query(query, [userId], (error, results) => {
        if (error) {
            console.error('Error al obtener los cursos:', error);
            return res.status(500).send('Error al cargar los cursos');
        }

        // Pasar todos los cursos a la vista, con el nombre 'cursos'
        res.render('cursos', { 
            cursos: results // Cambié 'curso' por 'cursos' para pasar el arreglo completo
        });
    });
});

//------------------Api de admin------------------

// Rutas para manejar la información de los cursos

//traer informacion de cursos
app.get('/adminCursos', isAdmin, (req, res) => {
    db.query('SELECT * FROM cursos', (error, results) => {
        if (error) {
            console.error('Error al obtener los cursos:', error);
            return res.status(500).send('Error al cargar los cursos');
        }
        
        
        // Asegúrate de que results no sea null o undefined
        const cursosData = results || [];
        
        res.render('adminCursos', { 
            cursos: cursosData,
            user: req.user // Si tienes información del usuario, también pásala
        });
    });
});

// Agregar un nuevo curso

app.post('/admin', isAdmin , (req, res) => {
    const { nombre_curso, URL_curso, duracion, valor, institucion } = req.body;
    const sql = 'INSERT INTO cursos (nombre_curso, URL_curso, duracion, valor, institucion ) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [nombre_curso, URL_curso, duracion, valor, institucion], (err, result) => {
        if (err) {
            res.status(500).send('Error agregando el curso');
            return;
        }
        res.redirect('/admin');
    });
});
// Ruta GET para editar un curso
app.get('/editarcurso/:id', isAdmin, (req, res) => {
    const { id } = req.params;
    // Consulta para obtener el curso por su ID
    const query = 'SELECT * FROM cursos WHERE id = ?';
    db.query(query, [id], (error, results) => {
        if (error) {
            console.error('Error al obtener los datos del curso:', error);
            return res.status(500).send('Error al obtener los datos del curso');
        }
        if (results.length === 0) {
            return res.status(404).send('Curso no encontrado');
        }
        const curso = results[0]; // Obtener el primer curso de la consulta
        res.render('editarCurso', { curso }); // Renderizar el formulario con los datos del curso
    });
});

// Actualizar un curso
app.put('/actualizarcurso/:id', isAdmin, (req, res) => {
    const { nombre_curso, URL_curso, duracion, valor, institucion } = req.body;
    const { id } = req.params;
    // Consulta para actualizar el curso
    const query = `UPDATE cursos SET nombre_curso = ?, URL_curso = ?, duracion = ?, valor = ?, institucion = ? WHERE id = ?`;
    db.query(query, [nombre_curso, URL_curso, duracion, valor, institucion, id], (error, results) => {
        if (error) {
            console.error('Error al actualizar el curso:', error);
            return res.status(500).send('Error al actualizar el curso');
        }
        
        // Redirigir al listado de cursos después de la actualización
        res.redirect('/adminCursos');
    });
});

   
//Eliminar un curso
app.get('/eliminarCurso/:id', isAdmin, (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM cursos WHERE id =?';
    db.query(query, [id], (error, result) => {
        if (error) {
            res.status(500).send('Error al eliminar el curso');
            return;
        }
        // Redirigir al administrrador después de eliminar el curso
        res.redirect('/adminCursos');
    });
});

// ------------ api info_cursos --------------------

app.get('/info_cursos/:id', isUser, (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM cursos WHERE id = ?';
    db.query(query, [id], (error, result) => {
        if (error) {
            res.status(500).send('Error al obtener el curso');
            return;
        }

        if (result.length > 0) {
            res.render('info_cursos', { curso: result[0] }); // Renderiza la vista con los datos del curso
        } else {
            res.status(404).send('Curso no encontrado');
        }
    });
});

// Ruta para agregar una calificación y opinión
app.post('/calificaciones', (req, res) => {
    const { id_Usuario, id_curso, Calificacion, Detalles, Fecha } = req.body;

    if (!id_Usuario || !id_curso || !Calificacion || !Detalles || !Fecha) {
        return res.status(400).send('Todos los campos son obligatorios');
    }

    const query = 'INSERT INTO calificaciones (id_Usuario, id_curso, Calificacion, Detalles, Fecha) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [id_Usuario, id_curso, Calificacion, Detalles, Fecha], (err, resultados) => {
        if (err) {
            console.error('Error al insertar la calificación:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        res.status(201).send('Calificación agregada correctamente');
    });
});

//siempre debe ir al final 

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    try {
        // Destruir la sesión
        req.session.destroy((err) => {
            if (err) {
                console.error('Error al cerrar sesión:', err);
                res.status(500).send('Error al cerrar sesión');
                return;
            }
            // Redireccionar al inicio
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error en el proceso de logout:', error);
        res.status(500).send('Error al procesar la solicitud');
    }
});



// Inicialización del servidor

app.listen(5000, (req, res) => {
    console.log('Servidor corriendo en http://localhost:5000/');
});