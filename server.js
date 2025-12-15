const express = require('express');
const app = express();
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');

require('dotenv').config();

// Configuración del puerto
const PORT = process.env.PORT || 3000;

// Middleware básico - ¡ORDEN IMPORTANTE!
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SESSION DEBE IR DESPUÉS DE express.json() Y ANTES DE LAS RUTAS
app.use(session({
  secret: process.env.SESSION_SECRET || 'mi_secreto_temporal_123',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

const connection = mysql.createConnection({
  host: process.env.DB_HOST,       // Host desde .env
  user: process.env.DB_USER,       // Usuario desde .env
  password: process.env.DB_PASSWORD,   // Contraseña desde .env
  database: process.env.DB_NAME    // Nombre de la base de datos desde .env
});

// Mensaje de inicio
console.log('---------------------------Iniciando servidor JavTech-----------------------------');
console.log('Directorio:', __dirname);
console.log('Puerto:', PORT);
console.log('-----------------------------------------------------------------------------------');

// Ruta principal - siempre a registro
app.get('/', (req, res) => {
  res.redirect('/registro.html');
});

// Ruta alternativa para index (si alguien accede directamente)
app.get('/index', (req, res) => {
  // Verificar sesión
  if (!req.session.user) {
    return res.redirect('/registro.html');
  }
  res.sendFile(__dirname + '/public/index.html');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`📁 Archivos estáticos: ${__dirname}/public`);
  console.log('👉 Presiona Ctrl+C para detener el servidor');
});

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio si no existe
const uploadsDir = path.join(__dirname, 'public', 'imgs', 'computadoras');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Si ya tenemos un ID de la computadora (para cuando se edita)
        const compId = req.body.id || req.params.id || 'temp';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, compId + '-' + uniqueSuffix + ext);
    }
});

// Filtrar solo imágenes
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB límite
    fileFilter: fileFilter
});






app.post('/registrar', (req, res) => {
    const { nombre_usuario, password, codigo_acceso } = req.body;
    console.log(req.body);

    const query = 'SELECT tipo_usuario FROM codigos_acceso WHERE codigo = ?';
    connection.query(query, [codigo_acceso], (err, results) => {

       console.log("Resultados: ", results);
        if (err || results.length === 0) {
          console.log(err);

          let html = `
            <html>
                <head>
                <link rel="stylesheet" href="/styles.css">
                </head>

                <body> 
                    <div>
                    <p> Error al registrar el usuario </p> </br>
                    <button id="Boton1" onclick="window.location.href='/'"> Volver </button>
                    </div>
                </body>
            </html>
          `;   

          return res.send(html);
        }

        console.log("Resultados 2: ", results);

        const tipo_usuario = results[0].tipo_usuario;
        const hashedPassword = bcrypt.hashSync(password, 10);

        const insertUser = 'INSERT INTO usuarios (nombre_usuario, contraseña_usuario, tipo_usuario) VALUES (?, ?, ?)';
        connection.query(insertUser, [nombre_usuario, hashedPassword, tipo_usuario], (err) => {
            if (err)  
            {

            console.log("Error 3:",err);
            
            let html = `
                <html>
                <head>
                  <link rel="stylesheet" href="/styles.css">
                </head>

                <body> 
                    <div>
                      <p> Error al registrar el usuario. </p> </br>
                      <button id="Boton1" onclick="window.location.href='/'"> Volver </button>
                    </div>
                </body>
                </html>
                `;   

                res.send(html);
              }
            
            res.redirect('/registro.html');
        });
    });
});

// Iniciar sesión
app.post('/login', (req, res) => {
  const { nombre_usuario, password } = req.body;
  console.log(nombre_usuario, password)

  connection.query('SELECT * FROM usuarios WHERE nombre_usuario = ?', 
    [nombre_usuario], async (err, results) => {
    if (err || results.length === 0) {
      let html = `
        <html>
          <head>
            <link rel="stylesheet" href="/styles.css">
          </head>

          <body> 
              <div id = "Caja2">
                <p> Los datos ingresados no coinciden con ningun usuario registrado.</p> </br>
                <button id="Boton1" onclick="window.location.href='/registro.html'"> Volver </button>
              </div>
          </body>
      `;   

      return res.send(html);
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.contraseña_usuario);

    if (match) {
      req.session.user = {
            id: user.id,
            username: user.nombre_usuario,
            tipo_usuario: user.tipo_usuario // Aquí se establece el tipo de usuario en la sesión
      };

      res.redirect('/index.html');

    } else {

      let html = `
        <html>
          <head>
            <link rel="stylesheet" href="/styles.css">
          </head>

          <body> 
              <div id = "Caja2">
                <p> Contraseña incorrecta. </p> </br>
                <button id="Boton1" onclick="window.location.href='/registro.html'"> Volver </button>
              </div>
          </body>
      `;   

      return res.send(html);
    }
  });
});

// Cerrar sesión
app.get('/logout', (req, res) => {
  // Destruye la sesión del servidor
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error al cerrar sesión');
    }

    // Borra la cookie en el navegador
    res.clearCookie('connect.sid');

    // Redirige al login
    res.redirect('/login.html');
  });
});




// Agrega esto en tu server.js (antes de app.listen)
app.get('/api/check-session', (req, res) => {
    if (req.session.user) {
        res.json({
            loggedIn: true,
            user: req.session.user
        });
    } else {
        res.json({
            loggedIn: false,
            user: null
        });
    }
});

// Agrega esta ruta también (para /tipo-usuario)
app.get('/tipo-usuario', (req, res) => {
    if (req.session.user) {
        res.json({
            tipo_usuario: req.session.user.tipo_usuario
        });
    } else {
        res.json({
            tipo_usuario: null
        });
    }
});

// Ruta para mostrar tabla de computadoras
app.get('/tabla-computadoras', (req, res) => {
    const query = 'SELECT * FROM computadoras ORDER BY id DESC';
    
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener computadoras:', err);
            return res.status(500).send(`
                <html>
                <head>
                    <title>Error</title>
                    <link rel="stylesheet" href="/styles.css">
                </head>
                <body>
                    <div class="container">
                        <h1>Error del servidor</h1>
                        <p>No se pudieron cargar los datos</p>
                        <a href="/" class="btn">Volver al inicio</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Generar la tabla HTML
        let tableHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tabla de Computadoras - JavTech</title>
            <link rel="stylesheet" href="/styles.css">
        </head>
        <body>
            <div id="navbar"></div>
            
            <div class="container">
                <div class="table-header">
                    <h1>📊 Tabla de Computadoras</h1>
                    <p>Total de registros: ${results.length}</p>
                    <a href="/" class="btn">🏠 Volver al Inicio</a>
                </div>
                
                <div class="table-responsive">
                    <table class="computadoras-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Procesador</th>
                                <th>Tarjeta Gráfica</th>
                                <th>RAM</th>
                                <th>Precio</th>
                                <th>Estado</th>
                                <th>Fecha Creación</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        // Agregar filas de datos
        results.forEach(comp => {
            // Convertir precio a número si viene como string
            const precio = parseFloat(comp.precio) || 0;
            
            let estadoClass = '';
            if (comp.estado === 'disponible') estadoClass = 'estado-disponible';
            else if (comp.estado === 'apartada') estadoClass = 'estado-apartada';
            else if (comp.estado === 'vendida') estadoClass = 'estado-vendida';
            
            // Formatear fecha
            const fecha = comp.fecha_creacion 
                ? new Date(comp.fecha_creacion).toLocaleDateString('es-MX')
                : 'N/A';
            
            tableHTML += `
                            <tr>
                                <td class="id-cell">${comp.id}</td>
                                <td>${comp.procesador}</td>
                                <td>${comp.tarjeta_grafica || 'Integrada'}</td>
                                <td>${comp.ram}</td>
                                <td class="precio-cell">$${precio.toFixed(2)}</td>
                                <td><span class="estado-badge ${estadoClass}">${comp.estado}</span></td>
                                <td>${fecha}</td>
                                <td class="actions-cell">
                                    <button onclick="editarComputadora(${comp.id})" class="btn-action btn-edit">✏️ Editar</button>
                                    <button onclick="eliminarComputadora(${comp.id})" class="btn-action btn-delete">🗑️ Eliminar</button>
                                </td>
                            </tr>`;
        });
        
        tableHTML += `
                        </tbody>
                    </table>
                </div>
                
                <div class="table-footer">
                    <a href="/agregar-computadora" class="btn btn-primary">➕ Agregar Nueva Computadora</a>
                </div>
            </div>
            
            <script>
                // FUNCIÓN IDÉNTICA A LA DE INDEX.HTML
                function cargarNavbarIndex() 
                {
                    fetch('/navbar.html')
                        .then(response => response.text())
                        .then(data => {
                            // Insertar navbar en el div
                            document.getElementById('navbar').innerHTML = data;
                            
                            // Ahora verificar tipo de usuario
                            return fetch('/tipo-usuario');
                        })
                        .then(response => response.json())
                        .then(data => {
                            // Buscar el elemento menu dentro de la navbar cargada
                            const menu = document.querySelector('#navbar ul') || document.createElement('ul');
                            
                            if (!document.querySelector('#navbar ul')) {
                                // Si no existe un ul, crear uno
                                const navbarDiv = document.getElementById('navbar');
                                const navElement = navbarDiv.querySelector('nav') || document.createElement('nav');
                                navElement.appendChild(menu);
                                navbarDiv.appendChild(navElement);
                            }
                            
                            const tipoUsuario = data.tipo_usuario;
                            
                            // Agregar opciones de menú según el tipo de usuario
                            if (tipoUsuario === 'admin') {
                                menu.innerHTML += '<li><a href="/catalogo">🛒 Catálogo </a></li>';
                                menu.innerHTML += '<li><a href="/tabla-computadoras">📊 Modificar</a></li>';
                                menu.innerHTML += '<li><a href="/agregar-computadora.html">➕ Añadir</a></li>';

                            } else if (tipoUsuario === 'cliente') {
                                menu.innerHTML += '<li><a href="/catalogo">🛒 Catálogo </a></li>';
                            } 

                            // Opción de cerrar sesión para todos los tipos de usuario
                            menu.innerHTML += '<li><a href="/logout">🚪 Cerrar Sesión</a></li>';
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            // Si hay error, mostrar navbar básica (IGUAL QUE EN INDEX)
                            document.getElementById('navbar').innerHTML = 
                                '<nav>' +
                                '<ul>' +
                                '<li><a href="/">🏠 Inicio</a></li>' +
                                '<li><a href="/logout">🚪 Cerrar Sesión</a></li>' +
                                '</ul>' +
                                '</nav>';
                        });
                }
                
                // LLAMAR A LA FUNCIÓN CUANDO SE CARGA LA PÁGINA
                document.addEventListener('DOMContentLoaded', function() {
                    cargarNavbarIndex();
                });
                
                // FUNCIONES PARA EDITAR Y ELIMINAR
                function editarComputadora(id) {
                    window.location.href = '/editar-computadora.html?id=' + id;
                }
                
                function eliminarComputadora(id) {
                    if (confirm('¿Estás seguro de eliminar esta computadora?')) {
                        fetch('/api/computadoras/' + id, {
                            method: 'DELETE'
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                alert(data.message);
                                location.reload();
                            } else {
                                alert(data.error || 'Error al eliminar');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            alert('Error al eliminar computadora');
                        });
                    }
                }
            </script>
        </body>
        </html>`;
        
        res.send(tableHTML);
    });
});


// DELETE - Eliminar computadora
app.delete('/api/computadoras/:id', (req, res) => {
    // Verificar si el usuario es admin
    if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos' });
    }
    
    const { id } = req.params;
    const query = 'DELETE FROM computadoras WHERE id = ?';
    
    connection.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar computadora:', err);
            return res.status(500).json({ error: 'Error al eliminar computadora' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Computadora no encontrada' });
        }
        
        res.json({ success: true, message: 'Computadora eliminada exitosamente' });
    });
});


// PUT - Actualizar computadora
app.put('/api/computadoras/:id', (req, res) => {
    // Verificar si el usuario es admin
    if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos' });
    }
    
    const { id } = req.params;
    const { procesador, tarjeta_grafica, ram, precio, estado } = req.body;
    
    const query = 'UPDATE computadoras SET procesador = ?, tarjeta_grafica = ?, ram = ?, precio = ?, estado = ? WHERE id = ?';
    
    connection.query(query, [procesador, tarjeta_grafica, ram, precio, estado, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar computadora:', err);
            return res.status(500).json({ error: 'Error al actualizar computadora' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Computadora no encontrada' });
        }
        
        res.json({ success: true, message: 'Computadora actualizada exitosamente' });
    });
});

// GET - Obtener una computadora específica por ID
app.get('/api/computadoras/:id', (req, res) => {
    const { id } = req.params;
    
    // Solo admin puede ver datos individuales (opcional, quita si quieres que sea público)
    // if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
    //     return res.status(403).json({ error: 'No tienes permisos' });
    // }
    
    const query = 'SELECT * FROM computadoras WHERE id = ?';
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener computadora:', err);
            return res.status(500).json({ error: 'Error en el servidor' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Computadora no encontrada' });
        }
        
        const computadora = results[0];
        
        // Convertir precio a número si es string
        if (typeof computadora.precio === 'string') {
            computadora.precio = parseFloat(computadora.precio);
        }
        
        res.json(computadora);
    });
});


// Ruta para agregar computadora (con soporte para imagen)
app.post('/api/computadoras', upload.single('imagen'), (req, res) => {
    // Verificar si es admin
    if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'No tienes permisos de administrador' 
        });
    }

    // Extraer datos del formulario
    const { procesador, tarjeta_grafica, ram, precio, estado } = req.body;
    
    // Validar datos requeridos
    if (!procesador || !ram || !precio || !estado) {
        return res.status(400).json({ 
            success: false, 
            error: 'Faltan campos requeridos' 
        });
    }
    
    // Preparar ruta de imagen
    let imagen_url = null;
    if (req.file) {
        // Guardar solo el nombre del archivo, no la ruta completa
        imagen_url = `/imgs/computadoras/${req.file.filename}`;
    }
    
    // Query para insertar
    const query = 'INSERT INTO computadoras (procesador, tarjeta_grafica, ram, precio, estado, imagen_url) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [procesador, tarjeta_grafica || 'Integrada', ram, parseFloat(precio), estado, imagen_url];
    
    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('Error al insertar computadora:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Error al guardar en la base de datos' 
            });
        }
        
        // Si se subió una imagen pero no tiene ID aún, renombrar con el ID generado
        if (req.file && result.insertId) {
            const oldPath = req.file.path;
            const newFilename = `${result.insertId}-${Date.now()}${path.extname(req.file.filename)}`;
            const newPath = path.join(uploadsDir, newFilename);
            
            fs.rename(oldPath, newPath, (renameErr) => {
                if (renameErr) {
                    console.error('Error al renombrar archivo:', renameErr);
                } else {
                    // Actualizar la URL en la base de datos
                    const updateQuery = 'UPDATE computadoras SET imagen_url = ? WHERE id = ?';
                    const newUrl = `/imgs/computadoras/${newFilename}`;
                    
                    connection.query(updateQuery, [newUrl, result.insertId], (updateErr) => {
                        if (updateErr) {
                            console.error('Error al actualizar URL de imagen:', updateErr);
                        }
                    });
                }
            });
        }
        
        res.json({
            success: true,
            message: 'Computadora agregada exitosamente',
            id: result.insertId,
            imagen_url: imagen_url
        });
    });
});

app.get('/agregar-computadora', (req, res) => {
    if (!req.session.user || req.session.user.tipo_usuario !== 'admin') {
        return res.redirect('/login.html');
    }
    res.sendFile(__dirname + '/public/agregar-computadora.html');
});


// Ruta para catálogo tipo tienda (público)
app.get('/catalogo', (req, res) => {
    const query = 'SELECT * FROM computadoras WHERE estado = "disponible" ORDER BY id DESC';
    
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener computadoras:', err);
            return res.status(500).send(`
                <html>
                <head>
                    <title>Error</title>
                    <link rel="stylesheet" href="/styles.css">
                </head>
                <body>
                    <div class="container">
                        <h1>Error del servidor</h1>
                        <p>No se pudieron cargar los datos</p>
                        <a href="/" class="btn">Volver al inicio</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Generar el catálogo HTML
        let catalogoHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Catálogo de Computadoras - JavTech</title>
            <link rel="stylesheet" href="/styles.css">
            <style>
                /* Estilos específicos para el catálogo */
                .catalogo-header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding: 30px;
                    background: rgba(30, 41, 59, 0.8);
                    border-radius: 15px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                }
                
                .catalogo-header h1 {
                    color: #5eead4;
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }
                
                .catalogo-header p {
                    color: #94a3b8;
                    font-size: 1.1rem;
                }
                
                /* Grid de tarjetas */
                .catalogo-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 30px;
                    margin-bottom: 50px;
                }
                
                /* Tarjeta de producto */
                .producto-card {
                    background: rgba(30, 41, 59, 0.95);
                    border-radius: 15px;
                    overflow: hidden;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }
                
                .producto-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                    border-color: #5eead4;
                }
                
                /* Imagen de la computadora */
                .producto-imagen {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    border-bottom: 1px solid rgba(94, 234, 212, 0.2);
                    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
                }
                
                /* Contenido de la tarjeta */
                .producto-contenido {
                    padding: 25px;
                }
                
                .producto-id {
                    display: inline-block;
                    background: rgba(94, 234, 212, 0.1);
                    color: #5eead4;
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-bottom: 15px;
                }
                
                .producto-titulo {
                    color: #e2e8f0;
                    font-size: 1.3rem;
                    margin-bottom: 15px;
                    font-weight: 600;
                    line-height: 1.4;
                }
                
                /* Especificaciones */
                .especificaciones {
                    margin: 20px 0;
                }
                
                .especificacion {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    color: #cbd5e1;
                    font-size: 0.95rem;
                }
                
                .especificacion-icono {
                    color: #5eead4;
                    margin-right: 10px;
                    font-size: 1rem;
                    min-width: 20px;
                }
                
                /* Precio */
                .producto-precio {
                    color: #10b981;
                    font-size: 1.8rem;
                    font-weight: 700;
                    text-align: center;
                    margin: 25px 0;
                    padding-top: 20px;
                    border-top: 1px solid rgba(148, 163, 184, 0.2);
                }
                
                /* Botones */
                .producto-acciones {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
                
                .btn-detalles {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    padding: 10px 20px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 500;
                    transition: all 0.3s;
                    flex: 1;
                    text-align: center;
                }
                
                .btn-detalles:hover {
                    background: rgba(59, 130, 246, 0.3);
                    transform: translateY(-2px);
                }
                
                .btn-comprar {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 500;
                    transition: all 0.3s;
                    flex: 1;
                    text-align: center;
                    cursor: pointer;
                }
                
                .btn-comprar:hover {
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    transform: translateY(-2px);
                }
                
                /* Mensaje si no hay productos */
                .sin-productos {
                    text-align: center;
                    padding: 60px;
                    background: rgba(30, 41, 59, 0.8);
                    border-radius: 15px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                }
                
                .sin-productos h3 {
                    color: #5eead4;
                    margin-bottom: 15px;
                }
                
                .sin-productos p {
                    color: #94a3b8;
                    margin-bottom: 25px;
                }
                
                /* Contador de productos */
                .contador-productos {
                    text-align: center;
                    color: #94a3b8;
                    margin-bottom: 30px;
                    font-size: 1.1rem;
                }
                
                .contador-productos span {
                    color: #5eead4;
                    font-weight: 600;
                }
                
                /* Responsive */
                @media (max-width: 768px) {
                    .catalogo-grid {
                        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                        gap: 20px;
                    }
                    
                    .catalogo-header {
                        padding: 20px;
                    }
                    
                    .catalogo-header h1 {
                        font-size: 2rem;
                    }
                    
                    .producto-contenido {
                        padding: 20px;
                    }
                }
                
                @media (max-width: 480px) {
                    .catalogo-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .producto-acciones {
                        flex-direction: column;
                    }
                }
            </style>
        </head>
        <body>
            <div id="navbar"></div>
            
            <div class="container">
                <div class="catalogo-header">
                    <h1>🛒 Catálogo de Computadoras</h1>
                    <p>Encuentra la computadora perfecta para tus necesidades</p>
                </div>
                
                <div class="contador-productos">
                    Mostrando <span>${results.length}</span> computadoras disponibles
                </div>
                
                <div class="catalogo-grid">`;
        
        // Si no hay productos disponibles
        if (results.length === 0) {
            catalogoHTML += `
                    <div class="sin-productos">
                        <h3>😔 No hay computadoras disponibles en este momento</h3>
                        <p>Pronto tendremos nuevo stock disponible.</p>
                        <a href="/" class="btn btn-primary">🏠 Volver al Inicio</a>
                    </div>`;
        } else {
            // Agregar tarjetas de productos
            results.forEach(comp => {
                const precio = parseFloat(comp.precio) || 0;
                // Usar imagen_url de la base de datos si existe, sino usar la predeterminada
                const imagenUrl = comp.imagen_url || `/imgs/computadoras/${comp.id}.png`;
                
                catalogoHTML += `
                    <div class="producto-card">
                        <img src="${imagenUrl}" 
                            alt="Computadora ${comp.procesador}" 
                            class="producto-imagen"
                            onerror="this.src='/imgs/default-pc.png'">
                        
                        <div class="producto-contenido">
                            <div class="producto-id">ID: ${comp.id}</div>
                            <h3 class="producto-titulo">${comp.procesador}</h3>
                            
                            <div class="especificaciones">
                                <div class="especificacion">
                                    <span class="especificacion-icono">🎮</span>
                                    <span><strong>Gráficos:</strong> ${comp.tarjeta_grafica || 'Integrada'}</span>
                                </div>
                                <div class="especificacion">
                                    <span class="especificacion-icono">💾</span>
                                    <span><strong>RAM:</strong> ${comp.ram}</span>
                                </div>
                                <div class="especificacion">
                                    <span class="especificacion-icono">📅</span>
                                    <span><strong>Estado:</strong> <span style="color:#4ade80">Disponible</span></span>
                                </div>
                            </div>
                            
                            <div class="producto-precio">$${precio.toFixed(2)} MXN</div>
                            
                            <div class="producto-acciones">
                                <a href="/detalle-computadora/${comp.id}" class="btn-detalles">🔍 Ver Detalles</a>
                                <button class="btn-comprar" onclick="mostrarInteres(${comp.id})">🛒 Interesado</button>
                            </div>
                        </div>
                    </div>`;
            });
        }
        
        catalogoHTML += `
                </div>
                
                <div style="text-align: center; margin-top: 40px;">
                    <a href="/" class="btn btn-secondary">🏠 Volver al Inicio</a>
                    ${req.session.user && req.session.user.tipo_usuario === 'admin' ? 
                      '<a href="/tabla-computadoras" class="btn btn-primary" style="margin-left: 15px;">📊 Panel Admin</a>' : ''}
                </div>
            </div>
            
            <script>
                // Cargar navbar (IGUAL QUE INDEX.HTML)
                document.addEventListener('DOMContentLoaded', function() {
                    cargarNavbarIndex();
                });
                
                function cargarNavbarIndex() {
                    fetch('/navbar.html')
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById('navbar').innerHTML = data;
                            return fetch('/tipo-usuario');
                        })
                        .then(response => response.json())
                        .then(data => {
                            const menu = document.querySelector('#navbar ul') || document.createElement('ul');
                            
                            if (!document.querySelector('#navbar ul')) {
                                const navbarDiv = document.getElementById('navbar');
                                const navElement = navbarDiv.querySelector('nav') || document.createElement('nav');
                                navElement.appendChild(menu);
                                navbarDiv.appendChild(navElement);
                            }
                            
                            const tipoUsuario = data.tipo_usuario;


                            
                            if (tipoUsuario === 'admin') {
                                menu.innerHTML += '<li><a href="/catalogo">🛒 Catálogo </a></li>';
                                menu.innerHTML += '<li><a href="/tabla-computadoras">📊 Modificar</a></li>';
                                menu.innerHTML += '<li><a href="/agregar-computadora.html">➕ Añadir</a></li>';

                            } else if (tipoUsuario === 'cliente') {
                                menu.innerHTML += '<li><a href="/catalogo">🛒 Catálogo </a></li>';
                            }

                            menu.innerHTML += '<li><a href="/logout">🚪 Cerrar Sesión</a></li>';
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            document.getElementById('navbar').innerHTML = 
                                '<nav><ul>' +
                                '<li><a href="/">🏠 Inicio</a></li>' +
                                '<li><a href="/catalogo">🛒 Catálogo</a></li>' +
                                '<li><a href="/logout">🚪 Salir</a></li>' +
                                '</ul></nav>';
                        });
                }
                
                // Función para mostrar interés en compra
                function mostrarInteres(idComputadora) {
                    if (confirm('¿Te interesa esta computadora? Un asesor se pondrá en contacto contigo.')) {
                        // Aquí puedes agregar lógica para guardar el interés
                        alert('✅ Hemos registrado tu interés. Te contactaremos pronto.');
                        
                        // Opcional: enviar al servidor
                        fetch('/api/interes-compra', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                computadora_id: idComputadora,
                                usuario_id: ${req.session.user ? req.session.user.id : 'null'}
                            })
                        }).catch(error => console.error('Error:', error));
                    }
                }
                
                // Mejorar carga de imágenes
                document.querySelectorAll('.producto-imagen').forEach(img => {
                    // Precargar imágenes
                    const tempImg = new Image();
                    tempImg.src = img.src;
                });
            </script>
            <style>
        /* HOVER DE INFORMACIÓN DE LA EMPRESA */
        .empresa-hover {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        
        .empresa-toggle {
            background: linear-gradient(135deg, #5eead4 0%, #3b82f6 100%);
            color: white;
            border: none;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .empresa-toggle:hover {
            transform: scale(1.1) rotate(90deg);
            box-shadow: 0 15px 35px rgba(94, 234, 212, 0.4);
        }
        
        .empresa-info {
            position: absolute;
            bottom: 70px;
            right: 0;
            width: 300px;
            background: rgba(30, 41, 59, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(94, 234, 212, 0.3);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
            opacity: 0;
            transform: translateY(20px) scale(0.9);
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            visibility: hidden;
        }
        
        .empresa-info.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            visibility: visible;
        }
        
        .empresa-header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(94, 234, 212, 0.3);
        }
        
        .empresa-logo {
            font-size: 2.5rem;
            margin-right: 15px;
            color: #5eead4;
        }
        
        .empresa-title {
            color: #5eead4;
            font-size: 1.3rem;
            font-weight: 600;
        }
        
        .empresa-datos {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .dato-item {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #e2e8f0;
            font-size: 0.95rem;
        }
        
        .dato-icon {
            color: #5eead4;
            font-size: 1.2rem;
            min-width: 25px;
        }
        
        .telefono-link {
            background: rgba(34, 197, 94, 0.2);
            color: #4ade80;
            padding: 10px 15px;
            border-radius: 10px;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            transition: all 0.3s;
            margin-top: 10px;
            border: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        .telefono-link:hover {
            background: rgba(34, 197, 94, 0.3);
            transform: translateY(-3px);
        }
        
        .empresa-footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid rgba(94, 234, 212, 0.2);
            text-align: center;
            color: #94a3b8;
            font-size: 0.85rem;
        }
        
        .whatsapp-badge {
            position: absolute;
            top: -10px;
            right: -10px;
            background: #25D366;
            color: white;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 600;
            animation: pulse-whatsapp 2s infinite;
            border: 2px solid rgba(30, 41, 59, 0.95);
        }
        
        @keyframes pulse-whatsapp {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        /* Versión flotante en el footer */
        .footer-empresa {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 1000;
        }
        
        .footer-toggle {
            background: rgba(30, 41, 59, 0.9);
            color: #5eead4;
            border: 1px solid rgba(94, 234, 212, 0.3);
            padding: 12px 20px;
            border-radius: 50px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            width: 120px;
            font-weight: 500;
            transition: all 0.3s;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        
        .footer-toggle:hover {
            background: rgba(94, 234, 212, 0.1);
            transform: translateY(-3px);
        }
        
        .footer-info {
            position: absolute;
            bottom: 60px;
            left: 0;
            width: 320px;
            background: rgba(30, 41, 59, 0.98);
            backdrop-filter: blur(15px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(94, 234, 212, 0.3);
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            visibility: hidden;
        }
        
        .footer-info.active {
            opacity: 1;
            transform: translateY(0) scale(1);
            visibility: visible;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .empresa-info, .footer-info {
                width: 280px;
                right: -10px;
            }
            
            .footer-info {
                left: -10px;
            }
            
            .empresa-toggle, .footer-toggle {
                width: 55px;
                height: 55px;
                font-size: 1.3rem;
            }
        }
        
        @media (max-width: 480px) {
            .empresa-hover {
                bottom: 15px;
                right: 15px;
            }
            
            .footer-empresa {
                bottom: 15px;
                left: 15px;
            }
            
            .empresa-info, .footer-info {
                width: 260px;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Tu contenido existente aquí -->
    
    <!-- OPCIÓN 1: Botón circular flotante (derecha) -->
    <div class="empresa-hover">
        <button class="empresa-toggle" onclick="toggleEmpresaInfo()">
            <span class="whatsapp-badge">📞</span>
            ℹ️
        </button>
        <div class="empresa-info" id="empresaInfo">
            <div class="empresa-header">
                <div class="empresa-logo">💻</div>
                <h3 class="empresa-title">JavTech</h3>
            </div>
            <div class="empresa-datos">
                <div class="dato-item">
                    <span class="dato-icon">📍</span>
                    <span>Tijuana, Baja California</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">🕒</span>
                    <span>Lun - Vie: 9:00 AM - 7:00 PM<br>Sab: 10:00 AM - 3:00 PM</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">✉️</span>
                    <span>javiervazquezsiytu@gmail.com</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">🏢</span>
                    <span>Especialistas en computadoras nuevas y de segunda mano</span>
                </div>
                <a href="tel:6644613062" class="telefono-link">
                    <span>📱</span>
                    <span>664 461 3062</span>
                </a>
            </div>
            <div class="empresa-footer">
                ¡Estamos aquí para ayudarte!
            </div>
        </div>
    </div>
    
    <!-- OPCIÓN 2: Barra flotante en el footer (izquierda) -->
    <div class="footer-empresa">
        <button class="footer-toggle" onclick="toggleFooterInfo()">
            <span>📞</span>
            Contactar
        </button>
        <div class="footer-info" id="footerInfo">
            <div class="empresa-header">
                <div class="empresa-logo">🚀</div>
                <h3 class="empresa-title">Contacto JavTech</h3>
            </div>
            <div class="empresa-datos">
                <div class="dato-item">
                    <span class="dato-icon">📞</span>
                    <span><strong>Teléfono Principal:</strong><br>664 461 3062</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">📱</span>
                    <span><strong>WhatsApp:</strong><br>Mismo número</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">📍</span>
                    <span><strong>Ubicación:</strong><br>Tijuana, Baja California</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">🎯</span>
                    <span><strong>Especialidad:</strong><br>Computadoras gaming y de trabajo</span>
                </div>
                <div class="dato-item">
                    <span class="dato-icon">🛡️</span>
                    <span><strong>Garantía:</strong><br>1 año en todos los equipos</span>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="tel:6644613062" class="telefono-link" style="flex: 1;">
                        <span>📞</span>
                        <span>Llamar</span>
                    </a>
                    <a href="https://wa.me/526644613062" target="_blank" class="telefono-link" style="flex: 1; background: rgba(37, 211, 102, 0.2); color: #25D366; border-color: rgba(37, 211, 102, 0.3);">
                        <span>💬</span>
                        <span>WhatsApp</span>
                    </a>
                </div>
            </div>
            <div class="empresa-footer">
                © 2024 JavTech - Tu tecnología, nuestra pasión
            </div>
        </div>
    </div>
    
    <script>
        // Función para mostrar/ocultar info empresa (Opción 1)
        function toggleEmpresaInfo() {
            const empresaInfo = document.getElementById('empresaInfo');
            const isActive = empresaInfo.classList.contains('active');
            
            // Cerrar el otro panel si está abierto
            const footerInfo = document.getElementById('footerInfo');
            if (footerInfo.classList.contains('active')) {
                footerInfo.classList.remove('active');
            }
            
            if (isActive) {
                empresaInfo.classList.remove('active');
            } else {
                empresaInfo.classList.add('active');
            }
        }
        
        // Función para mostrar/ocultar info footer (Opción 2)
        function toggleFooterInfo() {
            const footerInfo = document.getElementById('footerInfo');
            const isActive = footerInfo.classList.contains('active');
            
            // Cerrar el otro panel si está abierto
            const empresaInfo = document.getElementById('empresaInfo');
            if (empresaInfo.classList.contains('active')) {
                empresaInfo.classList.remove('active');
            }
            
            if (isActive) {
                footerInfo.classList.remove('active');
            } else {
                footerInfo.classList.add('active');
            }
        }
        
        // Cerrar al hacer click fuera
        document.addEventListener('click', function(event) {
            const empresaHover = document.querySelector('.empresa-hover');
            const footerEmpresa = document.querySelector('.footer-empresa');
            const empresaInfo = document.getElementById('empresaInfo');
            const footerInfo = document.getElementById('footerInfo');
            
            // Si el click no está dentro del elemento empresa-hover
            if (empresaHover && !empresaHover.contains(event.target)) {
                empresaInfo.classList.remove('active');
            }
            
            // Si el click no está dentro del elemento footer-empresa
            if (footerEmpresa && !footerEmpresa.contains(event.target)) {
                footerInfo.classList.remove('active');
            }
        });
        
        // Cerrar con tecla ESC
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                document.getElementById('empresaInfo').classList.remove('active');
                document.getElementById('footerInfo').classList.remove('active');
            }
        });
        
        // Inicializar al cargar la página
        document.addEventListener('DOMContentLoaded', function() {
            // Agregar animación inicial al botón
            setTimeout(() => {
                const toggleBtn = document.querySelector('.empresa-toggle');
                toggleBtn.style.animation = 'pulse 2s 2';
            }, 1000);
        });
    </script>
        </body>
        </html>`;
        
        res.send(catalogoHTML);
    });
});


// Ruta para ver detalles de una computadora específica
app.get('/detalle-computadora/:id', (req, res) => {
    const id = req.params.id;
    
    // Query para obtener los detalles de la computadora
    const query = 'SELECT * FROM computadoras WHERE id = ?';
    
    connection.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error al obtener detalles:', err);
            return res.status(500).send(`
                <html>
                <head>
                    <title>Error</title>
                    <link rel="stylesheet" href="/styles.css">
                </head>
                <body>
                    <div class="container">
                        <h1>Error del servidor</h1>
                        <p>No se pudieron cargar los detalles</p>
                        <a href="/catalogo" class="btn">Volver al catálogo</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Si no se encontró la computadora
        if (results.length === 0) {
            return res.status(404).send(`
                <html>
                <head>
                    <title>No encontrado</title>
                    <link rel="stylesheet" href="/styles.css">
                </head>
                <body>
                    <div class="container">
                        <h1>Computadora no encontrada</h1>
                        <p>La computadora que buscas no existe o ha sido eliminada</p>
                        <a href="/catalogo" class="btn">Volver al catálogo</a>
                    </div>
                </body>
                </html>
            `);
        }
        
        const comp = results[0];
        const precio = parseFloat(comp.precio) || 0;
        const imagenUrl = comp.imagen_url || `/imgs/computadoras/${comp.id}.png`;
        
        // Determinar color del estado
        let estadoColor = '#94a3b8';
        let estadoIcon = '🔄';
        
        switch(comp.estado) {
            case 'disponible':
                estadoColor = '#4ade80';
                estadoIcon = '🟢';
                break;
            case 'apartada':
                estadoColor = '#fbbf24';
                estadoIcon = '🟡';
                break;
            case 'vendida':
                estadoColor = '#ef4444';
                estadoIcon = '🔴';
                break;
        }
        
        // Generar HTML de detalles
        const detalleHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${comp.procesador} - JavTech</title>
            <link rel="stylesheet" href="/styles.css">
            <style>
                /* Estilos para la página de detalles */
                .detalle-container {
                    max-width: 1200px;
                    margin: 80px auto 40px;
                    padding: 0 20px;
                }
                
                .detalle-header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding: 30px;
                    background: rgba(30, 41, 59, 0.8);
                    border-radius: 15px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                }
                
                .detalle-header h1 {
                    color: #5eead4;
                    font-size: 2.5rem;
                    margin-bottom: 10px;
                }
                
                .detalle-header .id-badge {
                    display: inline-block;
                    background: rgba(94, 234, 212, 0.1);
                    color: #5eead4;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 15px;
                }
                
                /* Contenido principal */
                .detalle-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 40px;
                }
                
                @media (max-width: 900px) {
                    .detalle-content {
                        grid-template-columns: 1fr;
                    }
                }
                
                /* Imagen principal */
                .imagen-container {
                    background: rgba(30, 41, 59, 0.95);
                    border-radius: 15px;
                    padding: 20px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                    text-align: center;
                }
                
                .imagen-principal {
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 10px;
                    object-fit: contain;
                    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
                }
                
                /* Especificaciones */
                .especificaciones-container {
                    background: rgba(30, 41, 59, 0.95);
                    border-radius: 15px;
                    padding: 30px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                }
                
                .especificaciones-container h2 {
                    color: #5eead4;
                    font-size: 1.8rem;
                    margin-bottom: 25px;
                    padding-bottom: 15px;
                    border-bottom: 2px solid rgba(94, 234, 212, 0.2);
                }
                
                .especificacion-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: rgba(15, 23, 42, 0.5);
                    border-radius: 10px;
                    border-left: 4px solid #5eead4;
                }
                
                .especificacion-label {
                    color: #94a3b8;
                    font-size: 0.9rem;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                
                .especificacion-valor {
                    color: #e2e8f0;
                    font-size: 1.1rem;
                    font-weight: 600;
                }
                
                /* Precio y acciones */
                .precio-container {
                    text-align: center;
                    padding: 30px;
                    background: rgba(30, 41, 59, 0.95);
                    border-radius: 15px;
                    border: 1px solid rgba(94, 234, 212, 0.2);
                    margin-bottom: 30px;
                }
                
                .precio-label {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    margin-bottom: 10px;
                }
                
                .precio-valor {
                    color: #10b981;
                    font-size: 3rem;
                    font-weight: 700;
                    margin-bottom: 20px;
                }
                
                .precio-moneda {
                    font-size: 1.5rem;
                    color: #94a3b8;
                    margin-left: 5px;
                }
                
                /* Botones de acción */
                .acciones-container {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 30px;
                    flex-wrap: wrap;
                }
                
                .btn-detalle {
                    padding: 15px 30px;
                    border-radius: 10px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 1.1rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s;
                }
                
                .btn-volver {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }
                
                .btn-volver:hover {
                    background: rgba(59, 130, 246, 0.3);
                    transform: translateY(-3px);
                }
                
                .btn-comprar-detalle {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                
                .btn-comprar-detalle:hover:not(:disabled) {
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    transform: translateY(-3px);
                }
                
                .btn-admin {
                    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white;
                    border: none;
                }
                
                .btn-admin:hover {
                    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
                    transform: translateY(-3px);
                }
                
                /* Información adicional */
                .info-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px;
                    margin-top: 40px;
                }
                
                .info-card {
                    background: rgba(30, 41, 59, 0.8);
                    border-radius: 10px;
                    padding: 20px;
                    text-align: center;
                    border: 1px solid rgba(94, 234, 212, 0.1);
                }
                
                .info-card h3 {
                    color: #5eead4;
                    margin-bottom: 10px;
                    font-size: 1.2rem;
                }
                
                .info-card p {
                    color: #cbd5e1;
                    font-size: 0.95rem;
                }
                
                /* Estado con estilo */
                .estado-badge {
                    display: inline-block;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>
            <div id="navbar"></div>
            
            <div class="detalle-container">
                <div class="detalle-header">
                    <div class="id-badge">ID: ${comp.id}</div>
                    <h1>${comp.procesador}</h1>
                    <p>Detalles completos de la computadora</p>
                </div>
                
                <div class="detalle-content">
                    <!-- Imagen principal -->
                    <div class="imagen-container">
                        <img src="${imagenUrl}" 
                             alt="Computadora ${comp.procesador}" 
                             class="imagen-principal"
                             onerror="this.src='/imgs/default-pc.png'">
                    </div>
                    
                    <!-- Especificaciones -->
                    <div class="especificaciones-container">
                        <h2>📋 Especificaciones Técnicas</h2>
                        
                        <div class="especificacion-item">
                            <div class="especificacion-label">Procesador</div>
                            <div class="especificacion-valor">${comp.procesador}</div>
                        </div>
                        
                        <div class="especificacion-item">
                            <div class="especificacion-label">Tarjeta Gráfica</div>
                            <div class="especificacion-valor">${comp.tarjeta_grafica || 'Integrada'}</div>
                        </div>
                        
                        <div class="especificacion-item">
                            <div class="especificacion-label">Memoria RAM</div>
                            <div class="especificacion-valor">${comp.ram}</div>
                        </div>
                        
                        <div class="especificacion-item">
                            <div class="especificacion-label">Estado</div>
                            <div class="especificacion-valor">
                                ${estadoIcon} 
                                <span class="estado-badge" style="background: ${estadoColor}20; color: ${estadoColor}; border: 1px solid ${estadoColor}30;">
                                    ${comp.estado.charAt(0).toUpperCase() + comp.estado.slice(1)}
                                </span>
                            </div>
                        </div>
                        
                        <div class="especificacion-item">
                            <div class="especificacion-label">Precio</div>
                            <div class="especificacion-valor">$${precio.toFixed(2)} MXN</div>
                        </div>
                        
                        ${comp.descripcion ? `
                        <div class="especificacion-item">
                            <div class="especificacion-label">Descripción Adicional</div>
                            <div class="especificacion-valor" style="font-weight: normal;">${comp.descripcion}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Precio destacado -->
                <div class="precio-container">
                    <div class="precio-label">Precio Total</div>
                    <div class="precio-valor">
                        $${precio.toFixed(2)}
                        <span class="precio-moneda">MXN</span>
                    </div>
                    
                    <div class="acciones-container">
                        <a href="/catalogo" class="btn-detalle btn-volver">
                            ← Volver al Catálogo
                        </a>
                        
                        ${comp.estado === 'disponible' ? `
                        <button class="btn-detalle btn-comprar-detalle" onclick="mostrarInteres(${comp.id})">
                            🛒 Expresar Interés
                        </button>
                        ` : ''}
                        
                        ${req.session.user && req.session.user.tipo_usuario === 'admin' ? `
                        <a href="/tabla-computadoras" class="btn-detalle btn-admin">
                            ✏️ Editar
                        </a>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Información adicional -->
                <div class="info-container">
                    <div class="info-card">
                        <h3>🚚 Envío Gratis</h3>
                        <p>Envío gratuito a toda la república mexicana</p>
                    </div>
                    
                    <div class="info-card">
                        <h3>🛡️ Garantía</h3>
                        <p>1 año de garantía en todos los componentes</p>
                    </div>
                    
                    <div class="info-card">
                        <h3>📞 Soporte</h3>
                        <p>Soporte técnico especializado 24/7</p>
                    </div>
                    
                    <div class="info-card">
                        <h3>⚡ Disponibilidad</h3>
                        <p>${comp.estado === 'disponible' ? 'Disponible para envío inmediato' : 'Producto no disponible actualmente'}</p>
                    </div>
                </div>
            </div>
            
            <script>
                // Cargar navbar (MISMO SCRIPT QUE CATÁLOGO)
                document.addEventListener('DOMContentLoaded', function() {
                    cargarNavbarIndex();
                });
                
                function cargarNavbarIndex() {
                    fetch('/navbar.html')
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById('navbar').innerHTML = data;
                            return fetch('/tipo-usuario');
                        })
                        .then(response => response.json())
                        .then(data => {
                            const menu = document.querySelector('#navbar ul') || document.createElement('ul');
                            
                            if (!document.querySelector('#navbar ul')) {
                                const navbarDiv = document.getElementById('navbar');
                                const navElement = navbarDiv.querySelector('nav') || document.createElement('nav');
                                navElement.appendChild(menu);
                                navbarDiv.appendChild(navElement);
                            }
                            
                            const tipoUsuario = data.tipo_usuario;

                            // Agregar enlace al catálogo para todos
                            menu.innerHTML += '<li><a href="/catalogo">🛒 Catálogo</a></li>';
                            
                            if (tipoUsuario === 'admin') {
                                menu.innerHTML += '<li><a href="/tabla-computadoras">📊 Modificar</a></li>';
                                menu.innerHTML += '<li><a href="/agregar-computadora">➕ Añadir</a></li>';
                            } else if (tipoUsuario === 'cliente') {
                            }

                            menu.innerHTML += '<li><a href="/logout">🚪 Cerrar Sesión</a></li>';
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            document.getElementById('navbar').innerHTML = 
                                '<nav><ul>' +
                                '<li><a href="/">🏠 Inicio</a></li>' +
                                '<li><a href="/catalogo">🛒 Catálogo</a></li>' +
                                '<li><a href="/logout">🚪 Salir</a></li>' +
                                '</ul></nav>';
                        });
                }
                
                // Función para mostrar interés en compra (MISMA QUE EN CATÁLOGO)
                function mostrarInteres(idComputadora) {
                    if (confirm('¿Te interesa esta computadora? Un asesor se pondrá en contacto contigo.')) {
                        // Aquí puedes agregar lógica para guardar el interés
                        alert('✅ Hemos registrado tu interés. Te contactaremos pronto.');
                        
                        // Opcional: enviar al servidor
                        fetch('/api/interes-compra', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                computadora_id: idComputadora,
                                usuario_id: ${req.session.user ? req.session.user.id : 'null'}
                            })
                        }).catch(error => console.error('Error:', error));
                    }
                }
                
                // Mejorar experiencia de la imagen
                const imagen = document.querySelector('.imagen-principal');
                if (imagen) {
                    imagen.addEventListener('click', function() {
                        const modal = document.createElement('div');
                        modal.style.position = 'fixed';
                        modal.style.top = '0';
                        modal.style.left = '0';
                        modal.style.width = '100%';
                        modal.style.height = '100%';
                        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                        modal.style.zIndex = '9999';
                        modal.style.display = 'flex';
                        modal.style.justifyContent = 'center';
                        modal.style.alignItems = 'center';
                        
                        const modalImg = document.createElement('img');
                        modalImg.src = this.src;
                        modalImg.style.maxWidth = '90%';
                        modalImg.style.maxHeight = '90%';
                        modalImg.style.objectFit = 'contain';
                        
                        modal.appendChild(modalImg);
                        document.body.appendChild(modal);
                        
                        // Cerrar modal al hacer click
                        modal.addEventListener('click', function() {
                            document.body.removeChild(modal);
                        });
                    });
                }
            </script>
        </body>
        </html>`;
        
        res.send(detalleHTML);
    });
});

// Ruta para registrar interés en compra (opcional)
app.post('/api/interes-compra', (req, res) => {
    const { computadora_id, usuario_id } = req.body;
    
    // Aquí puedes guardar en una tabla 'intereses_compra'
    console.log(`Interés en computadora ${computadora_id} por usuario ${usuario_id}`);
    
    res.json({ success: true, message: 'Interés registrado' });
});


