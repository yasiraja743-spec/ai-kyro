// Legacy image provider helper retained for compatibility only.
// Active image generation now routes through VPS -> VPS.
export async function generatePixazoImage(){ throw new Error('Legacy Pixazo route disabled: use VPS gateway -> VPS Qwen-Image'); }
export const generateCloudflareImage = generatePixazoImage;
export const generatePollinationsImage = generatePixazoImage;
