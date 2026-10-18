import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import type { ComprehensionQuestion } from '../lib/types';

function Question({ question, index }: { question: ComprehensionQuestion; index: number }) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const choices = question.type === 'true_false' ? [{ id: 'true', text: t('Verdadero') }, { id: 'false', text: t('Falso') }] : question.options ?? [];
  const correct = answer === String(question.answer);
  const model = Array.isArray(question.answer) ? question.answer.join(' / ') : String(question.answer);
  return <fieldset className="comprehension-question"><legend><span>{index + 1}.</span> <span lang="ja">{question.question_ja}</span></legend>
    {question.question_es && <p>{t(question.question_es)}</p>}
    {question.type === 'short_answer' ? <label>{t('Tu respuesta (opcional)')}<textarea lang="ja" value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
      : <div className="quiz-choices">{choices.map((choice) => <label key={choice.id}><input type="radio" name={`quiz-${question.id}`} checked={answer === choice.id} onChange={() => { setAnswer(choice.id); setChecked(false); }} /><span lang={question.type === 'true_false' ? undefined : 'ja'}>{choice.text}</span></label>)}</div>}
    <button type="button" className="quiz-check" disabled={question.type !== 'short_answer' && !answer} onClick={() => setChecked(!checked)}>
      {t(checked ? 'Ocultar respuesta' : question.type === 'short_answer' ? 'Ver respuesta modelo' : 'Comprobar respuesta')}</button>
    {checked && <div className="quiz-feedback" role="status">
      <strong>{t(question.type === 'short_answer' ? 'Compara con el ejemplo; otras respuestas también pueden ser válidas.' : correct ? '¡Correcto!' : 'Vuelve a mirar esta parte de la historia.')}</strong>
      {question.type === 'short_answer' && <p lang="ja">{model}</p>}
      {question.explanation_es && <p>{t(question.explanation_es)}</p>}
    </div>}
  </fieldset>;
}
export function ComprehensionQuiz({ questions }: { questions: ComprehensionQuestion[] }) {
  const { t } = useI18n();
  if (!questions.length) return null;
  return <details className="comprehension-quiz"><summary><span>{t('¿Qué has entendido?')}</span><span>{t('Repaso de la historia')} +</span></summary>
    <p>{t('Un pequeño repaso, sin notas ni cambios en tu vocabulario.')}</p>
    {questions.map((question, index) => <Question key={question.id} question={question} index={index} />)}
  </details>;
}
