import twilio from "twilio";

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID as string,
  process.env.TWILIO_AUTH_TOKEN as string,
);

export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER as string;
