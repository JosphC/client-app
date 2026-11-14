import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { t } from '../../../core/i18n';
import { spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';
import SIGN_IN_DARK from '../../../assets/authSignInDark.png';
import SIGN_IN_LIGHT from '../../../assets/authSignIn.png';
import SIGN_UP_DARK from '../../../assets/authSignUpDark.png';
import SIGN_UP_LIGHT from '../../../assets/authSignUp.png';

/** PNG-uri transparente, decupate la desen; `ratio` = lățime/înălțime. */
const ART = {
  light: {
    signIn: { source: SIGN_IN_LIGHT, ratio: 1000 / 420 },
    signUp: { source: SIGN_UP_LIGHT, ratio: 1000 / 263 },
  },
  dark: {
    signIn: { source: SIGN_IN_DARK, ratio: 1000 / 437 },
    signUp: { source: SIGN_UP_DARK, ratio: 1000 / 321 },
  },
};

interface AuthHeroProps {
  signUp: boolean;
}

/** Ilustrație între titlu și formular: autobuz + metrou la conectare, stație la cont nou; variantă pe temă. */
export function AuthHero({ signUp }: AuthHeroProps) {
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();
  const set = isDark ? ART.dark : ART.light;
  const art = signUp ? set.signUp : set.signIn;
  // Dimensiuni explicite: `aspectRatio` pe un Image cu sursă locală se întindea pe tot ecranul.
  const imgWidth = width - spacing.lg * 2;

  return (
    <Image
      testID="auth-hero"
      source={art.source}
      accessible
      accessibilityIgnoresInvertColors
      accessibilityLabel={t('auth.heroLabel')}
      resizeMode="contain"
      style={[styles.image, { width: imgWidth, height: Math.round(imgWidth / art.ratio) }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { alignSelf: 'center' },
});
