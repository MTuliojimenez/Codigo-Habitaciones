// app.js - Lógica de la aplicación Vue para sistema de terminales
document.getElementById('current-year').textContent = new Date().getFullYear();

// Variables para la instalación
let deferredPrompt;
const installButton = document.getElementById('installButton');

// Asegurarnos de que el botón esté inicializado correctamente
document.addEventListener('DOMContentLoaded', function() {
    // Asegurarse de que el botón existe antes de continuar
    if (installButton) {
        console.log('Botón de instalación inicializado');
        
        // Verificar si está en iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
        
        // Si es iOS y no está en modo standalone, mostrar el botón
        if (isIOS && !isInStandaloneMode) {
            installButton.style.display = 'block';
            
            // Configurar el evento para iOS
            installButton.addEventListener('click', showIOSInstallInstructions);
        }
    } else {
        console.error('Botón de instalación no encontrado en el DOM');
    }
});

// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js')
            .then(function (registration) {
                console.log('Service Worker registrado con éxito:', registration.scope);
            })
            .catch(function (error) {
                console.log('Error al registrar el Service Worker:', error);
            });
    });
}

// Escuchar el evento beforeinstallprompt (para Android/Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir que Chrome muestre automáticamente el prompt
    e.preventDefault();
    
    // Guardar el evento para usarlo después
    deferredPrompt = e;
    
    // Mostrar el botón de instalación
    if (installButton) {
        installButton.style.display = 'block';
        
        // Asegurarnos de que el evento click esté configurado correctamente
        // Primero removemos cualquier listener anterior para evitar duplicados
        installButton.removeEventListener('click', handleInstallClick);
        // Luego añadimos el nuevo listener
        installButton.addEventListener('click', handleInstallClick);
        
        console.log('Prompt de instalación preparado y botón activado');
    }
});

// Función para manejar el clic en el botón de instalación (Android/Chrome)
async function handleInstallClick() {
    console.log('Botón de instalación clickeado');
    
    if (!deferredPrompt) {
        console.log('No hay prompt de instalación disponible');
        return;
    }
    
    // Mostrar el prompt de instalación
    deferredPrompt.prompt();
    
    // Esperar a que el usuario responda al prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`Respuesta del usuario al prompt de instalación: ${outcome}`);
    
    // Ya no necesitamos el prompt
    deferredPrompt = null;
    
    // Ocultar el botón de instalación
    installButton.style.display = 'none';
}

// Función para mostrar instrucciones de instalación en iOS
function showIOSInstallInstructions() {
    console.log('Mostrando instrucciones para iOS');
    
    // Crear el modal
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '10px';
    content.style.maxWidth = '90%';
    content.style.textAlign = 'center';

    content.innerHTML = `
        <h4>Instalar en iPhone/iPad</h4>
        <p>Para instalar esta app en tu dispositivo:</p>
        <ol style="text-align: left">
            <li>Toca el ícono <i class="fas fa-share-square"></i> de compartir</li>
            <li>Desplázate y selecciona "Agregar a pantalla de inicio"</li>
            <li>Toca "Agregar" para confirmar</li>
        </ol>
        <button id="closeModal" class="btn btn-primary mt-3">Entendido</button>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Agregar evento al botón para cerrar el modal
    document.getElementById('closeModal').addEventListener('click', function () {
        document.body.removeChild(modal);
    });
}

// Si la app ya está instalada, ocultar el botón
window.addEventListener('appinstalled', () => {
    console.log('App ya instalada');
    if (installButton) {
        installButton.style.display = 'none';
    }
    deferredPrompt = null;
});

// Inicialización de Vue
new Vue({
    el: '#app',
    // Necesitamos usar delimitadores personalizados para evitar conflictos con Jinja2
    delimiters: ['${', '}'],
    data: {
        terminalId: '',
        terminalNombre: '',
        hotelSeleccionado: '',
        resultados: [],
        cargando: false,
        error: null,
        busquedaRealizada: false,
        // La URL base de la API - Ajustar según el entorno
        apiUrl: '/api', // Al estar en el mismo servidor, usamos una URL relativa
        valores: [1, 2, 4, 8, 16, 32, 64, 128],
        listaHoteles: [],
        listaTerminales: {}, // Objeto que almacenará los terminales por hotel
        listaTerminalesFiltradas: []
    },
    created() {
        // Cargar la lista de hoteles al iniciar la aplicación
        this.cargarListaHoteles();
    },
    methods: {
        // Cargar lista de hoteles
        cargarListaHoteles() {
            this.cargando = true;
            this.error = null;

            axios.get(`${this.apiUrl}/hoteles`)
                .then(response => {
                    if (response.data && response.data.hoteles) {
                        this.listaHoteles = response.data.hoteles;
                    } else {
                        console.error('Formato de respuesta inesperado:', response.data);
                        this.error = 'Error al cargar la lista de hoteles';
                    }
                })
                .catch(error => {
                    console.error('Error al cargar hoteles:', error);
                    this.error = error.response ? error.response.data.error : 'Error al comunicarse con el servidor';

                })
                .finally(() => {
                    this.cargando = false;
                });
        },


        // Cargar terminales por hotel seleccionado
        cargarTerminalesPorHotel() {
            if (!this.hotelSeleccionado) {
                this.listaTerminalesFiltradas = [];
                this.terminalNombre = '';
                return;
            }

            this.cargando = true;
            this.error = null;

            // Si ya tenemos los terminales para este hotel en memoria, los usamos
            if (this.listaTerminales[this.hotelSeleccionado]) {
                this.listaTerminalesFiltradas = this.listaTerminales[this.hotelSeleccionado];
                this.cargando = false;
                return;
            }

            axios.get(`${this.apiUrl}/terminales/hotel/${encodeURIComponent(this.hotelSeleccionado)}`)
                .then(response => {
                    if (response.data && response.data.terminales) {
                        // Guardamos los terminales de este hotel en memoria
                        this.listaTerminales[this.hotelSeleccionado] = response.data.terminales;
                        this.listaTerminalesFiltradas = response.data.terminales;
                    } else {
                        console.error('Formato de respuesta inesperado:', response.data);
                        this.error = 'Error al cargar los terminales del hotel';

                        // Si no hay respuesta o la API no está lista, usar datos de prueba
                        if (!this.listaTerminales[this.hotelSeleccionado]) {
                            this.cargarDatosPrueba();
                            this.listaTerminalesFiltradas = this.listaTerminales[this.hotelSeleccionado] || [];
                        }
                    }
                })
                .catch(error => {
                    console.error('Error al cargar terminales del hotel:', error);
                    this.error = error.response ? error.response.data.error : 'Error al comunicarse con el servidor';

                    // Si ocurre un error, intentamos usar los datos de prueba
                    if (!this.listaTerminales[this.hotelSeleccionado]) {
                        this.cargarDatosPrueba();
                        this.listaTerminalesFiltradas = this.listaTerminales[this.hotelSeleccionado] || [];
                    }
                })
                .finally(() => {
                    this.cargando = false;
                });
        },

        // Buscar terminal por ID
        buscarPorId() {
            if (!this.terminalId.trim()) {
                this.error = 'Por favor, ingrese un ID de terminal';
                return;
            }

            this.cargando = true;
            this.error = null;
            this.busquedaRealizada = true;
            this.resultados = [];

            axios.get(`${this.apiUrl}/terminales/id/${this.terminalId}`)
                .then(response => {
                    if (Array.isArray(response.data)) {
                        this.resultados = response.data;
                    } else {
                        this.resultados = [response.data];
                    }
                })
                .catch(error => {
                    console.error('Error en la búsqueda por ID:', error);
                    this.error = error.response ? error.response.data.error : 'Error al comunicarse con el servidor';
                })
                .finally(() => {
                    this.cargando = false;
                });
        },

        // Buscar terminal por nombre
        buscarPorNombre() {
            if (!this.terminalNombre) {
                this.error = 'Por favor, seleccione un terminal';
                return;
            }

            this.cargando = true;
            this.error = null;
            this.busquedaRealizada = true;
            this.resultados = [];

            axios.get(`${this.apiUrl}/buscar`, {
                params: {
                    nombre: this.terminalNombre
                }
            })
                .then(response => {
                    if (Array.isArray(response.data)) {
                        this.resultados = response.data;
                    } else {
                        this.resultados = [response.data];
                    }
                })
                .catch(error => {
                    console.error('Error en la búsqueda por nombre:', error);
                    this.error = error.response ? error.response.data.error : 'Error al comunicarse con el servidor';
                })
                .finally(() => {
                    this.cargando = false;
                });
        },

        // Verificar si el terminal tiene campos adicionales para mostrar
        tieneOtrosCampos(terminal) {
            const camposFiltrados = this.filtrarCamposEstandar(terminal);
            return Object.keys(camposFiltrados).length > 0;
        },

        // Filtrar campos estándar y formatear los valores adicionales
        filtrarCamposEstandar(terminal) {
            // Campos que deseamos excluir de la visualización adicional
            const camposExcluidos = [
                'Hotel',
                'Nombre',
                'Edificio',
                'DCU'
                // Agregar aquí cualquier otro campo que ya se muestre en otra parte
            ];

            // Crear un nuevo objeto con los campos filtrados
            let camposFiltrados = {};

            for (let clave in terminal) {
                // Si la clave no está en los campos excluidos y tiene un valor
                if (!camposExcluidos.includes(clave) && terminal[clave] !== null && terminal[clave] !== '') {
                    // Formatear el nombre de la clave para mejor presentación
                    const claveFormateada = this.formatearNombreClave(clave);
                    camposFiltrados[claveFormateada] = terminal[clave];
                }
            }

            return camposFiltrados;
        },

        // Método auxiliar para formatear nombres de clave
        formatearNombreClave(clave) {
            // Reemplazar guiones bajos por espacios y capitalizar
            return clave
                .replace(/_/g, ' ')
                .split(' ')
                .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
                .join(' ');
        },

        // Obtener configuración de pines para un ID
        obtenerPines(id) {
            // Convertir ID a número entero
            const idNum = parseInt(id, 10);

            // Convertir a representación binaria de 8 bits (para los 8 pines)
            // Creamos un array de 8 posiciones con 0s y 1s
            const pines = [];

            // Verificar cada valor del pin (1, 2, 4, 8, 16, 32, 64, 128)
            for (let i = 0; i < this.valores.length; i++) {
                const valorPin = this.valores[i];
                // Si el bit correspondiente está activado (1), el pin debe estar "arriba"
                if (idNum & valorPin) {
                    pines.push(1); // Pin arriba (negro)
                } else {
                    pines.push(0); // Pin abajo (blanco)
                }
            }

            return pines;
        },
        // Agregar método de carga de datos de prueba si es necesario
        cargarDatosPrueba() {
            // Implementación básica para evitar errores
            if (!this.listaTerminales[this.hotelSeleccionado]) {
                this.listaTerminales[this.hotelSeleccionado] = [];
            }
        }
    }
});