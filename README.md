# ImMiku

<div align="center">

![Tema](https://img.shields.io/badge/Tema-Miku_Nakano-3a86ff?style=for-the-badge)
![API](https://img.shields.io/badge/API-CatBox.moe-2b2d42?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/Plataforma-GitHub_Pages-0077b6?style=for-the-badge)

*Plataforma estática de optimización y carga de archivos hacia CatBox con interfaz personalizada.*

---

</div>

## Visión General

**ImMiku** es una aplicación web ligera diseñada para desplegarse en GitHub Pages. Permite subir imágenes, videos y archivos multimedia a un servidor externo ([CatBox](https://catbox.moe)) de forma instantánea, generando URLs directas para su distribución rápida.

> **Desarrollador:** Chizu  
> **Temática:** Miku Nakano (*Gotoubun no Hanayome*)

---

## Funcionalidades Principales

| Componente | Descripción |
| :--- | :--- |
| **Carga Intuitiva** | Soporte para arrastrar y soltar (*Drag & Drop*) y selector de archivos nativo. |
| **Generador de Enlaces** | Copiado automático y manual al portapapeles del enlace directo generado. |
| **Vista Previa** | Previsualización embebida en tiempo real para imágenes y reproductor de video. |
| **Monitor de Carga** | Barra de estado y progreso dinámico durante la transferencia del archivo. |
| **Historial Local** | Persistencia de datos mediante `localStorage` para consultar enlaces previos sin backend. |
| **Diseño Adaptativo** | Interfaz responsive optimizada para dispositivos móviles, tablets y escritorio. |

---

## Despliegue en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube el contenido del proyecto a la raíz de la rama principal (`main`).
3. Dirígete a **Settings > Pages** en tu repositorio.
4. En la sección **Source**, selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda los cambios para obtener la URL pública de tu sitio.

---

## Funcionamiento Técnico

La aplicación consume la API pública y anónima de CatBox mediante peticiones HTTP POST directas:

```text
POST [https://catbox.moe/user/api.php](https://catbox.moe/user/api.php)
reqtype=fileupload
fileToUpload=<archivo>
