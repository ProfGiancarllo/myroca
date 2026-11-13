import { getCurrentLanguage } from '../i18n';

type Dict = Record<string, string>;
const en: Dict = {
  title: 'Access to SpaceAgro', subtitle: 'Sign in or create your account to manage your farm.',
  tabLogin: 'Sign in', tabSignup: 'Create account',
  name: 'Full name', email: 'E-mail', phone: 'Phone (optional)', farm: 'Farm name', city: 'City / State',
  password: 'Password', password2: 'Repeat password', passwordHint: 'At least 8 characters, with letters and numbers.',
  keep: 'Keep me signed in on this device',
  consent: 'I agree that SpaceAgro stores my data on this device to run the app (LGPD).',
  btnLogin: 'Sign in', btnSignup: 'Create account and enter', guest: 'Explore without an account (demo)',
  forgot: 'Forgot my password', forgotMsg: 'In this demo version the account lives only on this device, so the password cannot be recovered. You can delete this account and its data and create it again.',
  forgotDelete: 'Delete this account and its data', forgotDone: 'Account deleted. You can create it again.',
  localNote: 'Demo mode: accounts and farm data stay saved in this browser only.',
  errRequired: 'Fill in all required fields.', errEmail: 'Enter a valid e-mail.', errPwShort: 'Password needs at least 8 characters, with letters and numbers.',
  errPwMismatch: 'The passwords do not match.', errConsent: 'You need to accept the data use to create an account.',
  errExists: 'There is already an account with this e-mail.', errBadLogin: 'Wrong e-mail or password.',
  errLocked: 'Too many attempts. Try again in {s} s.', errCrypto: 'This browser cannot protect passwords. Open the app over HTTPS.',
  logout: 'Sign out', guestName: 'Guest',
};
const pt: Dict = {
  title: 'Acesso ao SpaceAgro', subtitle: 'Entre ou crie sua conta para gerenciar sua fazenda.',
  tabLogin: 'Entrar', tabSignup: 'Criar conta',
  name: 'Nome completo', email: 'E-mail', phone: 'Telefone (opcional)', farm: 'Nome da fazenda', city: 'Cidade / UF',
  password: 'Senha', password2: 'Repita a senha', passwordHint: 'Pelo menos 8 caracteres, com letras e números.',
  keep: 'Manter conectado neste aparelho',
  consent: 'Concordo que o SpaceAgro guarde meus dados neste aparelho para funcionar (LGPD).',
  btnLogin: 'Entrar', btnSignup: 'Criar conta e entrar', guest: 'Conhecer sem conta (demonstração)',
  forgot: 'Esqueci minha senha', forgotMsg: 'Nesta versão de demonstração a conta existe só neste aparelho, então a senha não pode ser recuperada. Você pode apagar esta conta e os dados dela e criar de novo.',
  forgotDelete: 'Apagar esta conta e os dados', forgotDone: 'Conta apagada. Você pode criar de novo.',
  localNote: 'Modo demonstração: contas e dados da fazenda ficam salvos só neste navegador.',
  errRequired: 'Preencha todos os campos obrigatórios.', errEmail: 'Informe um e-mail válido.', errPwShort: 'A senha precisa de pelo menos 8 caracteres, com letras e números.',
  errPwMismatch: 'As senhas não são iguais.', errConsent: 'É preciso aceitar o uso dos dados para criar a conta.',
  errExists: 'Já existe uma conta com este e-mail.', errBadLogin: 'E-mail ou senha incorretos.',
  errLocked: 'Muitas tentativas. Tente de novo em {s} s.', errCrypto: 'Este navegador não consegue proteger senhas. Abra o app por HTTPS.',
  logout: 'Sair', guestName: 'Visitante',
};
const es: Dict = {
  title: 'Acceso a SpaceAgro', subtitle: 'Inicia sesión o crea tu cuenta para gestionar tu finca.',
  tabLogin: 'Entrar', tabSignup: 'Crear cuenta',
  name: 'Nombre completo', email: 'Correo electrónico', phone: 'Teléfono (opcional)', farm: 'Nombre de la finca', city: 'Ciudad / Estado',
  password: 'Contraseña', password2: 'Repite la contraseña', passwordHint: 'Al menos 8 caracteres, con letras y números.',
  keep: 'Mantener la sesión en este dispositivo',
  consent: 'Acepto que SpaceAgro guarde mis datos en este dispositivo para funcionar (LGPD).',
  btnLogin: 'Entrar', btnSignup: 'Crear cuenta y entrar', guest: 'Conocer sin cuenta (demostración)',
  forgot: 'Olvidé mi contraseña', forgotMsg: 'En esta versión de demostración la cuenta existe solo en este dispositivo, por lo que la contraseña no se puede recuperar. Puedes borrar esta cuenta y sus datos y crearla de nuevo.',
  forgotDelete: 'Borrar esta cuenta y sus datos', forgotDone: 'Cuenta borrada. Puedes crearla de nuevo.',
  localNote: 'Modo demostración: las cuentas y los datos de la finca se guardan solo en este navegador.',
  errRequired: 'Completa todos los campos obligatorios.', errEmail: 'Ingresa un correo válido.', errPwShort: 'La contraseña necesita al menos 8 caracteres, con letras y números.',
  errPwMismatch: 'Las contraseñas no coinciden.', errConsent: 'Debes aceptar el uso de los datos para crear la cuenta.',
  errExists: 'Ya existe una cuenta con este correo.', errBadLogin: 'Correo o contraseña incorrectos.',
  errLocked: 'Demasiados intentos. Inténtalo de nuevo en {s} s.', errCrypto: 'Este navegador no puede proteger contraseñas. Abre la app por HTTPS.',
  logout: 'Salir', guestName: 'Invitado',
};
const de: Dict = {
  title: 'Zugang zu SpaceAgro', subtitle: 'Melden Sie sich an oder erstellen Sie Ihr Konto, um Ihren Betrieb zu verwalten.',
  tabLogin: 'Anmelden', tabSignup: 'Konto erstellen',
  name: 'Vollständiger Name', email: 'E-Mail', phone: 'Telefon (optional)', farm: 'Name des Betriebs', city: 'Stadt / Bundesstaat',
  password: 'Passwort', password2: 'Passwort wiederholen', passwordHint: 'Mindestens 8 Zeichen, mit Buchstaben und Zahlen.',
  keep: 'Auf diesem Gerät angemeldet bleiben',
  consent: 'Ich stimme zu, dass SpaceAgro meine Daten zur Nutzung auf diesem Gerät speichert (LGPD).',
  btnLogin: 'Anmelden', btnSignup: 'Konto erstellen und starten', guest: 'Ohne Konto ausprobieren (Demo)',
  forgot: 'Passwort vergessen', forgotMsg: 'In dieser Demoversion existiert das Konto nur auf diesem Gerät, das Passwort kann daher nicht wiederhergestellt werden. Sie können dieses Konto samt Daten löschen und neu anlegen.',
  forgotDelete: 'Dieses Konto und seine Daten löschen', forgotDone: 'Konto gelöscht. Sie können es neu anlegen.',
  localNote: 'Demomodus: Konten und Betriebsdaten werden nur in diesem Browser gespeichert.',
  errRequired: 'Bitte alle Pflichtfelder ausfüllen.', errEmail: 'Bitte eine gültige E-Mail eingeben.', errPwShort: 'Das Passwort braucht mindestens 8 Zeichen, mit Buchstaben und Zahlen.',
  errPwMismatch: 'Die Passwörter stimmen nicht überein.', errConsent: 'Zum Erstellen des Kontos muss der Datennutzung zugestimmt werden.',
  errExists: 'Mit dieser E-Mail existiert bereits ein Konto.', errBadLogin: 'E-Mail oder Passwort falsch.',
  errLocked: 'Zu viele Versuche. Erneut versuchen in {s} s.', errCrypto: 'Dieser Browser kann Passwörter nicht schützen. App über HTTPS öffnen.',
  logout: 'Abmelden', guestName: 'Gast',
};
const zh: Dict = {
  title: '登录 SpaceAgro', subtitle: '登录或创建账户以管理您的农场。',
  tabLogin: '登录', tabSignup: '创建账户',
  name: '姓名', email: '电子邮箱', phone: '电话（选填）', farm: '农场名称', city: '城市 / 州',
  password: '密码', password2: '再次输入密码', passwordHint: '至少 8 个字符，包含字母和数字。',
  keep: '在此设备上保持登录',
  consent: '我同意 SpaceAgro 在此设备上保存我的数据以运行应用（LGPD）。',
  btnLogin: '登录', btnSignup: '创建账户并进入', guest: '无需账户体验（演示）',
  forgot: '忘记密码', forgotMsg: '演示版本的账户仅保存在此设备上，因此无法找回密码。您可以删除此账户及其数据后重新创建。',
  forgotDelete: '删除此账户及其数据', forgotDone: '账户已删除，可重新创建。',
  localNote: '演示模式：账户和农场数据仅保存在此浏览器中。',
  errRequired: '请填写所有必填项。', errEmail: '请输入有效的电子邮箱。', errPwShort: '密码至少 8 个字符，需包含字母和数字。',
  errPwMismatch: '两次输入的密码不一致。', errConsent: '创建账户需同意数据使用。',
  errExists: '该邮箱已有账户。', errBadLogin: '邮箱或密码错误。',
  errLocked: '尝试次数过多，请 {s} 秒后重试。', errCrypto: '此浏览器无法保护密码，请通过 HTTPS 打开应用。',
  logout: '退出', guestName: '访客',
};
const fr: Dict = {
  title: 'Accès à SpaceAgro', subtitle: 'Connectez-vous ou créez votre compte pour gérer votre exploitation.',
  tabLogin: 'Se connecter', tabSignup: 'Créer un compte',
  name: 'Nom complet', email: 'E-mail', phone: 'Téléphone (facultatif)', farm: "Nom de l'exploitation", city: 'Ville / État',
  password: 'Mot de passe', password2: 'Répétez le mot de passe', passwordHint: 'Au moins 8 caractères, avec lettres et chiffres.',
  keep: 'Rester connecté sur cet appareil',
  consent: "J'accepte que SpaceAgro enregistre mes données sur cet appareil pour fonctionner (LGPD).",
  btnLogin: 'Se connecter', btnSignup: 'Créer le compte et entrer', guest: 'Découvrir sans compte (démo)',
  forgot: "Mot de passe oublié", forgotMsg: "Dans cette version de démonstration, le compte n'existe que sur cet appareil : le mot de passe ne peut pas être récupéré. Vous pouvez supprimer ce compte et ses données, puis le recréer.",
  forgotDelete: 'Supprimer ce compte et ses données', forgotDone: 'Compte supprimé. Vous pouvez le recréer.',
  localNote: "Mode démo : comptes et données de l'exploitation restent enregistrés dans ce navigateur uniquement.",
  errRequired: 'Remplissez tous les champs obligatoires.', errEmail: 'Saisissez un e-mail valide.', errPwShort: 'Le mot de passe doit avoir au moins 8 caractères, avec lettres et chiffres.',
  errPwMismatch: 'Les mots de passe ne correspondent pas.', errConsent: "Vous devez accepter l'utilisation des données pour créer le compte.",
  errExists: 'Un compte existe déjà avec cet e-mail.', errBadLogin: 'E-mail ou mot de passe incorrect.',
  errLocked: 'Trop de tentatives. Réessayez dans {s} s.', errCrypto: "Ce navigateur ne peut pas protéger les mots de passe. Ouvrez l'app en HTTPS.",
  logout: 'Se déconnecter', guestName: 'Invité',
};
const ALL: Record<string, Dict> = { en, pt, es, de, zh, fr };

export function at(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
}
