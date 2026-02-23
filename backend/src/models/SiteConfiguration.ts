import mongoose, { Schema, Model } from "mongoose";

export interface ISiteConfiguration {
  host: string;
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
  host: {type: String, required: true},
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
});

export const SiteConfiguration: Model<ISiteConfiguration> = mongoose.models.SiteConfiguration || mongoose.model<ISiteConfiguration>('SiteConfiguration', SiteConfigurationSchema);
