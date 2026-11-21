import { currentNavigator, isIos } from './platform.ts'
import { strings } from './strings.es.ts'
import './print-step.css'

export function DoneStep() {
  const ios = isIos(currentNavigator())
  return (
    <div className="print-step">
      <p className="print-notice">{strings.doneStep.instruction}</p>
      {ios && (
        <section className="ios-guide" aria-labelledby="ios-guide-title">
          <h2 id="ios-guide-title" className="ios-guide-title">
            {strings.doneStep.iosGuideTitle}
          </h2>
          <ol>
            {strings.doneStep.iosGuideSteps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
