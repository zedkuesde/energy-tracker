import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log(
  'VAPID_SUBJECT=mailto:votre-email@example.com  # ou https://votre-domaine.example',
);
console.log(
  '\nCollez ces valeurs dans .env (jamais dans Git). Conservez les mêmes clés en production.',
);
