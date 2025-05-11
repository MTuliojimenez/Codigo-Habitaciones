# app.py - API Flask para servicio de terminales
from flask import Flask, jsonify, request, render_template
import pandas as pd
import os
from waitress import serve
from flask_cors import CORS  # Para permitir peticiones desde el frontend
import logging

app = Flask(__name__)
CORS(app)  # Habilitamos CORS para todas las rutas


def load_data():
    """Carga los datos del CSV con manejo de cache"""

    csv_path = os.path.join(os.path.dirname(__file__), 'terminales.csv')
    try:
        df = pd.read_csv(csv_path, encoding='utf-8')
        # Limpiamos espacios en todas las columnas de texto
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].str.strip()
        print(f"Datos cargados correctamente. Forma: {df.shape}")
        
        # Guardamos en cache
        #_df_cache = df
        return df
    except Exception as e:
        print(f"Error al cargar los datos: {e}")
        return None
    
@app.route('/')
def interfaz():
    return render_template('index.html')

#esta ruta busca los hoteles o areas, las guarda para desplegar en una lista
@app.route('/api/hoteles', methods=['GET'])
def listar_hoteles():
    """Endpoint para listar todos los hoteles disponibles"""
    df = load_data()
    if df is None:
        return jsonify({"error": "No se pudieron cargar los datos"}), 500
    
    # Extraer la columna Hotel (si existe) o crear una clasificación por défecto
    if 'Hotel' in df.columns:
        hoteles = df['Hotel'].dropna().unique().tolist()
        print("Se cargaron los Hoteles")
    else:
        print("No se cargaron los Hoteles")
        # Si no hay columna Hotel, intentamos extraer el hotel del nombre del terminal
        # Esto asume que los nombres de los terminales tienen un formato como "Hotel X - Terminal Y"
        hoteles = []
        for nombre in df['Nombre_terminal'].dropna().unique():
            partes = nombre.split(' - ')
            if len(partes) > 1 and partes[0].startswith('Hotel'):
                if partes[0] not in hoteles:
                    hoteles.append(partes[0])
        
        # Si aún no hay hoteles identificados, creamos una clasificación genérica
        if not hoteles:
            hoteles = ['Hotel Principal']
    return jsonify({"hoteles": sorted(hoteles)})


#Busca las terminales que hay en cada Hotel Area
@app.route('/api/terminales/hotel/<path:hotel>', methods=['GET'])
def listar_terminales_por_hotel(hotel):
    """Endpoint para listar todos los terminales de un hotel específico"""
    df = load_data()
    if df is None:
        return jsonify({"error": "No se pudieron cargar los datos"}), 500
    
    # Filtrar por hotel si existe la columna
    if 'Hotel' in df.columns:
        terminales_hotel = df[df['Hotel'] == hotel]['Nombre'].dropna().unique().tolist()
    else:
        # Si no hay columna Hotel, intentamos filtrar por el nombre del terminal
        terminales_hotel = []
        for nombre in df['Nombre'].dropna().unique():
            if nombre.startswith(hotel) or hotel in nombre:
                terminales_hotel.append(nombre)
        
        # Si no hay terminales identificados, devolvemos todos
        if not terminales_hotel:
            terminales_hotel = df['Nombre'].dropna().unique().tolist()
    return jsonify({"terminales": sorted(terminales_hotel)})




# Buscar todos los terminales que coincidan con un ID
@app.route('/api/terminales/id/<Codigo>', methods=['GET'])
def get_terminales_by_id(terminal_id):
    df = load_data()
    if df is None:
        return jsonify({"error": "No se pudieron cargar los datos"}), 500
    
    terminales = df[df['Codigo'].astype(str) == str(terminal_id)]
    
    if terminales.empty:
        return jsonify({"error": f"No se encontraron terminales con ID {terminal_id}"}), 404
    print("SE USO /api/terminales/id/<Codigo>")
    results = terminales.to_dict(orient='records')
    return jsonify(results)


# Ruta alternativa para búsqueda por nombre sin problemas de URL
@app.route('/api/buscar', methods=['GET'])
def buscar_terminal():
    df = load_data()
    if df is None:
        return jsonify({"error": "No se pudieron cargar los datos"}), 500
    
    # Obtenemos el parámetro 'nombre' de la URL (ejemplo: /api/buscar?nombre=Habitacion 1001)
    nombre = request.args.get('nombre', '')
    
    if not nombre:
        return jsonify({"error": "Debe proporcionar un parámetro 'nombre'"}), 400
    
    # Limpiamos los datos para la comparación
    nombre = nombre.strip()
  
    df['Nombre_terminal_clean'] = df['Nombre'].str.strip()
    # Búsqueda exacta
    terminal = df[df['Nombre_terminal_clean'] == nombre]
    
    print(terminal)
    
    if terminal.empty:
        # Intentar búsqueda case-insensitive
        terminal = df[df['Nombre_terminal_clean'].str.lower() == nombre.lower()]
        
        if terminal.empty:
            # Como último recurso, buscar si el nombre está contenido
            terminal = df[df['Nombre_terminal_clean'].str.contains(nombre, case=False)]
    
    if terminal.empty:
        return jsonify({"error": f"No se encontró el terminal con nombre '{nombre}'"}), 404
    
    # Devolvemos todas las coincidencias
    results = terminal.to_dict(orient='records')
    # Eliminamos la columna auxiliar
    for result in results:
        if 'Nombre_terminal_clean' in result:
            del result['Nombre_terminal_clean']
    return jsonify(results)

@app.route('/sw.js')
def service_worker():
    return app.send_static_file('sw.js')

@app.route('/manifest.json')
def manifest():
    return app.send_static_file('manifest.json')

if __name__ == '__main__':
    port = 8000
    host = "0.0.0.0"
    logging.info(f"Iniciando servidor Waitress en {host}:{port}")
    app.run(debug=True , host='0.0.0.0', port=8000)
    #serve(app, host=host, port= port)