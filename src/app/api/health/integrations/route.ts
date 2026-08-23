import { NextResponse } from "next/server";
import { resend } from "@/lib/email/resend";
import { cloudinary } from "@/lib/upload/cloudinary";
import { pusherServer } from "@/lib/chat/pusher";
import { razorpay } from "@/lib/payments/razorpay";

function isConfigured(value: string | undefined) {
  return !!value && !value.includes("placeholder");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    clientsLoaded: {
      resend: !!resend,
      cloudinary: !!cloudinary.config().cloud_name,
      pusher: !!pusherServer,
      razorpay: !!razorpay,
    },
    configured: {
      resend: isConfigured(process.env.RESEND_API_KEY),
      cloudinary: isConfigured(process.env.CLOUDINARY_CLOUD_NAME),
      pusher: isConfigured(process.env.PUSHER_APP_ID),
      razorpay: isConfigured(process.env.RAZORPAY_KEY_ID),
      razorpayx: isConfigured(process.env.RAZORPAYX_ACCOUNT_NUMBER),
      twilio: isConfigured(process.env.TWILIO_ACCOUNT_SID),
      google: isConfigured(process.env.GOOGLE_CLIENT_ID),
      daily: isConfigured(process.env.DAILY_API_KEY),
    },
  });
}
