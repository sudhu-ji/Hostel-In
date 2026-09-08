import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { publicId, resourceType } = await request.json();
    if (!publicId) {
      return NextResponse.json({ error: "Missing publicId" }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn("Cloudinary credentials not fully configured in env. Skipping server-side deletion.");
      return NextResponse.json({ success: true, message: "Mock delete (credentials not set)" });
    }

    // Generate signature for Cloudinary API request
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const signatureRaw = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    
    // Hash SHA-1 using native Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureRaw);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("api_key", apiKey);
    formData.append("signature", signature);

    const type = resourceType || "image";
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`, {
      method: "POST",
      body: formData
    });

    const resData = await res.json();
    if (resData.result === "ok" || resData.result === "not_found") {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: resData.error || "Destroy failed" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Cloudinary delete API route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
