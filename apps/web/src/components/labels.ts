import { backend } from '@/lib/backend'
import { t } from '@/i18n/t'
import { demoMode } from '@/config/switches'
import type { ContactLabels, ReportLabels } from './client/Dialogs'
import type { RsvpLabels } from './client/RsvpCard'
import type { AgeLabels, SignInLabels } from './client/Flows'

// Client components get their words from the server as props, straight from messages/en.json (05-COPY).
const demoNote = () => (demoMode ? t('ui')('demoNothingSaved') : null)

export function reportLabels(): ReportLabels {
  const s = t('safety')
  return {
    report: s('report'),
    reasons: [s('reasonHurt'), s('reasonBullying'), s('reasonPersonal'), s('reasonSpam'), s('reasonOther')],
    details: s('details'),
    send: s('send'),
    urgent: s('urgent'),
    sentTodo: 'COPY §Safety — the "Sent" line needs the operator\'s response time (06 #3)',
    close: t('nav')('close'),
    demo: demoNote(),
  }
}

export function contactLabels(): ContactLabels {
  const c = t('club')
  return {
    title: c('contactTitle'), helper: c('contactHelper'), name: c('yourName'), email: c('yourEmail'), message: c('yourMessage'),
    send: c('send'), sent: c('sent'), close: t('nav')('close'), demo: demoNote(),
  }
}

export function rsvpLabels(): RsvpLabels {
  const e = t('events')
  return {
    rsvp: e('rsvp'), going: e('going'), cancel: e('cancel'), full: e('full'), ended: e('ended'),
    onlineLink: e('onlineLink'), exactPlace: e('exactPlace'), calendar: e('calendar'), signIn: t('nav')('signIn'), demo: demoNote(),
  }
}

export function signInLabels(): SignInLabels {
  const s = t('signIn')
  return {
    intro: s('intro'), email: s('email'), send: s('send'), check: s('check'), code: s('code'), submit: s('submit'),
    resend: s('resend'), resendIn: s.raw('resendIn') as string, codeHelp: s('codeHelp'), demo: demoMode ? s('demo') : null,
    live: backend === 'supabase',
  }
}

export function ageLabels(): AgeLabels {
  const o = t('onboarding')
  const j = t('join')
  return {
    age: o('age'), under13: o('under13'), band1315: o('band1315'), band1617: o('band1617'), adult: o('adult'),
    under13Stop: o('under13Stop'), band1315Stop: o('band1315Stop'), continue: t('welcome')('continue'),
    teacherOrStudent: o('teacherOrStudent'), teacher: o('teacher'), student: o('student'),
    codeLabel: j('codeLabel'), codeSubmit: j('submit'), askInvite: t('nav')('teachers'),
  }
}
