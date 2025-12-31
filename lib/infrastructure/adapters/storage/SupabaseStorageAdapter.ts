import { StoragePort } from '../../../core/application/ports/StoragePort';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase/SupabaseClient';
import { logger } from '../../../core/application/Logger';

export class SupabaseStorageAdapter implements StoragePort {
    private bucketName = 'recall-assets';

    async uploadFile(path: string, file: Buffer, mimeType: string): Promise<string> {
        if (!isSupabaseConfigured() || !supabaseAdmin) {
            logger.warn('Supabase storage not configured, skipping upload', { path });
            return `https://placeholder.url/${path}`;
        }

        try {
            const { data, error } = await supabaseAdmin.storage
                .from(this.bucketName)
                .upload(path, file, {
                    contentType: mimeType,
                    upsert: true
                });

            if (error) throw error;

            console.log(data);

            // Get public URL
            const { data: { publicUrl } } = supabaseAdmin.storage
                .from(this.bucketName)
                .getPublicUrl(path);

            return publicUrl;
        } catch (error: any) {
            logger.error('Failed to upload file to Supabase', { path, error: error.message });
            throw error;
        }
    }

    async deleteFile(path: string): Promise<void> {
        if (!isSupabaseConfigured() || !supabaseAdmin) {
            return;
        }

        try {
            const { error } = await supabaseAdmin.storage
                .from(this.bucketName)
                .remove([path]);

            if (error) throw error;
        } catch (error: any) {
            logger.error('Failed to delete file from Supabase', { path, error: error.message });
            // Don't throw for deletion, just log
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!isSupabaseConfigured() || !supabaseAdmin) return false;
        try {
            const { error } = await supabaseAdmin.storage.getBucket(this.bucketName);
            return !error;
        } catch {
            return false;
        }
    }
}
