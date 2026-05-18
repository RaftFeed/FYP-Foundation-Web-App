import { supabase } from './supabase';

export async function compressImage(file: File, maxMb: number = 1): Promise<File> {
  const maxBytes = maxMb * 1024 * 1024;
  
  // If the file is already small enough, just return it
  if (file.size <= maxBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Optionally scale down dimensions to reduce size faster
      const maxDim = 1200;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Binary search for the right quality to get under maxBytes
      let low = 0.1;
      let high = 0.95;
      let bestBlob: Blob | null = null;
      
      const attemptCompression = (quality: number, depth: number = 0) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            if (blob.size <= maxBytes) {
              bestBlob = blob;
              // If we're within 10% of the target or reached max depth, we're good enough
              if (depth >= 5 || blob.size > maxBytes * 0.9) {
                resolve(new File([bestBlob], file.name, { type: 'image/jpeg' }));
                return;
              }
              // Try higher quality
              low = quality;
            } else {
              // Try lower quality
              high = quality;
            }
            
            if (depth < 5) {
              attemptCompression((low + high) / 2, depth + 1);
            } else if (bestBlob) {
              resolve(new File([bestBlob], file.name, { type: 'image/jpeg' }));
            } else {
              // Even at lowest quality it's too big, just return lowest
              resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      attemptCompression(0.8);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    
    img.src = objectUrl;
  });
}

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const compressedFile = await compressImage(file, 1);
  const fileExt = compressedFile.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  // Clean up old avatars in storage to avoid storage bloat
  try {
    const { data: existingFiles, error: listError } = await supabase.storage
      .from('avatars')
      .list(userId);

    if (!listError && existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }
  } catch (err) {
    console.error('Failed to clean up old avatars:', err);
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, compressedFile, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Gagal mengupload foto: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  
  if (!data.publicUrl) {
    throw new Error('Gagal mendapatkan URL publik dari foto yang diupload');
  }
  
  return data.publicUrl;
}
