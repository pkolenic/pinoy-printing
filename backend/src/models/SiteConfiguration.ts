import mongoose, { Schema, Model } from "mongoose";

export interface IFrontendConfig {
  auth0: {
    domain: string;
    audience: string;
    clientId: string;
  };
  hero: {
    title: string;
    description: string;
    image: string;
  };
  settings: {
    requireAuthentication: boolean;
  };
  site: {
    name: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    errorColor: string;
    paperColor: string;
  };
}

export interface ISiteConfiguration {
  host: string;
  frontend: IFrontendConfig;

  auth0Domain: string;
  auth0Audience: string;
  auth0ClientId: string;

  siteName: string;
  siteAddress: string;
  sitePhone: string;
  siteEmail: string;
  siteCurrency: string;

  requireAuthentication: boolean;

  primaryColor: string;
  secondaryColor: string;
  errorColor: string;
  paperColor: string;

  heroTitle: string;
  heroDescription: string;
  heroImage: string;
}

export const SiteConfigurationSchema = new Schema<ISiteConfiguration>({
  host: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  frontend: {
    auth0: {
      domain: {type: String, required: true},
      audience: {type: String, required: true},
      clientId: {type: String, required: true},
    },
    hero: {
      title: {type: String, required: false},
      description: {type: String, required: false},
      image: {type: String, required: false},
    },
    settings: {
      requireAuthentication: {type: Boolean, required: true, default: false},
    },
    site: {
      name: {type: String, required: true},
      address: {type: String, required: true},
      phone: {type: String, required: true},
      email: {type: String, required: true},
      currency: {type: String, required: true},
    },
    theme: {
      primaryColor: {type: String, required: false},
      secondaryColor: {type: String, required: false},
      errorColor: {type: String, required: false},
      paperColor: {type: String, required: false},
    },
  },

  auth0Domain: {type: String, required: true},
  auth0Audience: {type: String, required: true},
  auth0ClientId: {type: String, required: true},

  siteName: {type: String, required: true},
  siteAddress: {type: String, required: true},
  sitePhone: {type: String, required: true},
  siteEmail: {type: String, required: true},
  siteCurrency: {type: String, required: true},

  requireAuthentication: {type: Boolean, required: true, default: false},

  primaryColor: {type: String, required: false},
  secondaryColor: {type: String, required: false},
  errorColor: {type: String, required: false},
  paperColor: {type: String, required: false},

  heroTitle: {type: String, required: false},
  heroDescription: {type: String, required: false},
  heroImage: {type: String, required: false},
}, { timestamps: true });

export const SiteConfiguration: Model<ISiteConfiguration> = mongoose.models.SiteConfiguration || mongoose.model<ISiteConfiguration>('SiteConfiguration', SiteConfigurationSchema);
