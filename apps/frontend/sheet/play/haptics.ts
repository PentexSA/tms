import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

// Háptico do modo Jogo (design system: Stepper, CombatDock, Track): seleção a
// cada passo, impacto na ação padrão do dock e um padrão mais forte no dano
// mais grave da trilha. É reforço, nunca a única pista: o valor e o aviso
// continuam na tela. No web não há motor de vibração confiável: nada acontece.

const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return
  // Aparelho sem motor ou permissão negada (rejeita ou lança): segue sem
  // háptico, a alteração já foi feita
  Promise.resolve()
    .then(fn)
    .catch(() => undefined)
}

export const haptics = {
  selection: () => run(() => Haptics.selectionAsync()),
  impact: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  severe: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    ),
}
