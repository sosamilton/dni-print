// Every user-visible text lives here, in Rioplatense Spanish (voseo).
export const strings = {
  appName: 'DNI Print',
  tagline: 'Imprimí tu DNI a tamaño real. Todo pasa en tu dispositivo.',
  wizard: {
    back: 'Atrás',
    stepCounter: (step: number, total: number) => `Paso ${step} de ${total}`,
    progressLabel: 'Avance del asistente',
  },
  menu: {
    button: '⋮',
    buttonLabel: 'Más opciones',
    privacy: 'Cómo funciona y privacidad',
    sourceCode: 'Código fuente',
    sourceCodeUnavailable: 'No disponible en esta versión',
    close: 'Cerrar',
  },
  privacyDialog: {
    title: 'Cómo funciona y privacidad',
    paragraphs: [
      'Todo se procesa en tu dispositivo, dentro del navegador. No hay cuentas ni servidores.',
      'Las fotos no se guardan ni se envían a ningún lado. Al cerrar la app, se borran.',
      'DNI Print es software libre, con licencia AGPL-3.0. El código fuente está en el menú ⋮, en «Código fuente».',
    ],
  },
  loadStep: {
    documentLabel: 'Documento',
    faces: { front: 'Frente', back: 'Dorso' },
    missing: 'Falta esta cara',
    processing: 'Procesando…',
    loaded: (face: string) => `${face} ✓`,
    notImage: 'Ese archivo no es una imagen. Probá con una foto JPG o PNG.',
    genericError: 'No pudimos leer esa foto. Probá con otra.',
    takePhoto: 'Sacar foto',
    pickFromGallery: 'Elegir de la galería',
    replaceHint: 'Tocá para reemplazar',
    dropHint: 'o soltá la foto acá',
    thumbnailLabel: (face: string) => `Miniatura de ${face}`,
    privacyNotice: 'Las fotos no salen de tu teléfono. Se borran al cerrar la app.',
  },
  steps: {
    load: {
      title: 'Cargá las dos caras de tu DNI',
      body: 'Vas a necesitar una foto del frente y otra del dorso.',
      primary: 'Continuar',
    },
    crop: {
      title: '¿Quedó bien recortado?',
      body: 'Acá vas a revisar que el documento se vea derecho y completo.',
      primary: 'Se ve bien',
    },
    print: {
      title: 'Elegí cuántas copias',
      body: 'Acá vas a ver la hoja A4 antes de descargarla.',
      primary: 'Descargar PDF',
    },
    done: {
      title: 'Ya tenés tu PDF',
      body: 'Al imprimir elegí Tamaño real o 100 %.',
      primary: 'Borrar fotos',
    },
  },
} as const
