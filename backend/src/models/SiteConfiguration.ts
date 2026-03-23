import { Schema, HydratedDocument } from "mongoose";

export interface IFrontendConfig {
  auth0: {
    domain: string;
    audience: string;
    clientId: string;
    connection: string;
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
    selectedColor: string;
    selectedHoverColor: string;
  };
}

export interface IBackendConfig {
  database: {
    name: string;
    url: string;
  };
  redis: {
    url: string;
  }
  auth0: {
    audience: string;
    issuerDomain: string;
    tokenSigningAlgorithm: string;
    managementClientId: string;
    managementClientSecret: string;
    authorizationDB: string;
  };
  settings: {
    requireAuthentication: boolean;
  };
  static: {
    favIcon: string;
  }
}

export interface ISiteConfiguration {
  tenantId: string;
  frontend: IFrontendConfig;
  backend: IBackendConfig;
}

export type ISiteConfigurationDocument = HydratedDocument<ISiteConfiguration>;

export const SiteConfigurationSchema = new Schema<ISiteConfiguration>({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  frontend: {
    auth0: {
      domain: { type: String, required: true },
      audience: { type: String, required: true },
      clientId: { type: String, required: true },
      connection: { type: String, required: true },
    },
    hero: {
      title: { type: String, required: false },
      description: { type: String, required: false },
      image: { type: String, required: false },
    },
    settings: {
      requireAuthentication: { type: Boolean, required: true, default: false },
    },
    site: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
      currency: { type: String, required: true },
    },
    theme: {
      primaryColor: { type: String, required: false },
      secondaryColor: { type: String, required: false },
      errorColor: { type: String, required: false },
      paperColor: { type: String, required: false },
    },
  },
  backend: {
    database: {
      name: { type: String, required: true },
      url: { type: String, required: true },
    },
    redis: {
      url: { type: String, required: true },
    },
    auth0: {
      audience: { type: String, required: true },
      issuerDomain: { type: String, required: true },
      tokenSigningAlgorithm: { type: String, required: true },
      managementClientId: { type: String, required: true },
      managementClientSecret: { type: String, required: true },
      authorizationDB: { type: String, required: true },
    },
    settings: {
      requireAuthentication: { type: Boolean, required: true, default: false },
    },
    static: {
      favIcon: { type: String, required: false },
    },
  },
}, { timestamps: true });
