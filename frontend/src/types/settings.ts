export interface IAuth0Settings {
  domain: string;
  audience: string;
  clientId: string;
}

export interface IHeroSettings {
  title: string;
  description: string;
  image: string;
}

export interface ISettings {
  requireAuthentication: boolean;
}

export interface ISiteSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
}

export interface IThemeColors {
  primaryColor: string;
  secondaryColor: string;
  errorColor: string;
  paperColor: string;
  selectedColor: string;
  selectedHoverColor: string;
}

export interface ISiteConfig {
  auth0: IAuth0Settings;
  hero: IHeroSettings;
  settings: ISettings;
  site: ISiteSettings;
  theme: IThemeColors;
}
