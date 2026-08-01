// One-off: generate a VAPID key pair for Web Push.
//   npm run vapid:keys
// Copy the two lines it prints into .env.local. The public key is safe to ship
// to the browser (NEXT_PUBLIC_*); keep the private key server-side only.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
