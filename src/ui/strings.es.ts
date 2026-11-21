// Every user-visible text lives here, in Rioplatense Spanish (voseo).
export const strings = {
  appName: 'DNI Print',
  tagline: 'Imprimí tu DNI a tamaño real. Todo pasa en tu dispositivo.',
  wizard: {
    back: 'Atrás',
    stepCounter: (step: number, total: number) => `Paso ${step} de ${total}`,
    progressLabel: 'Avance del asistente',
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
