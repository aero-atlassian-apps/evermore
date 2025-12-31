/**
 * Storage Port - Interface for file storage
 */
export interface StoragePort {
    /**
     * Upload a file to storage
     * @param path Path to store the file (e.g., 'users/123/avatar.png')
     * @param file Buffer of the file content
     * @param mimeType MIME type of the file
     * @returns Public URL of the uploaded file
     */
    uploadFile(path: string, file: Buffer, mimeType: string): Promise<string>;

    /**
     * Delete a file from storage
     * @param path Path of the file to delete
     */
    /**
     * Check if storage service is available
     */
    isAvailable(): Promise<boolean>;
}
