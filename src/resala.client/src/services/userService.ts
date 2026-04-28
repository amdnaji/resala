import api from './api';

const API_BASE_URL = '/users';

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  profilePictureUrl?: string;
  preferredLanguage?: string;
}

export interface UserProfileResponse {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  profilePictureUrl?: string;
  lastSeenAt: string;
  isOnline: boolean;
  preferredLanguage: string;
}

/**
 * Service to handle user profile operations.
 */
export const userService = {
  /**
   * Updates the current user's profile.
   * @param data The profile data to update.
   * @returns The updated user profile.
   */
  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfileResponse> => {
    const response = await api.put(`${API_BASE_URL}/profile`, data);
    return response.data;
  },

  /**
   * Fetches the current user's profile information.
   * @returns The current user's profile.
   */
  getMe: async (): Promise<UserProfileResponse> => {
    const response = await api.get(`${API_BASE_URL}/me`);
    return response.data;
  },

  /**
   * Searches for users based on a query string.
   * @param query The search term.
   * @returns A list of matching users.
   */
  searchUsers: async (query: string): Promise<UserProfileResponse[]> => {
    const response = await api.get(`${API_BASE_URL}/search`, { params: { query } });
    return response.data;
  },

  /**
   * Uploads a profile picture in chunks.
   * @param file The file to upload.
   * @param onProgress Callback function for progress updates (0-100).
   * @returns The new profile picture URL.
   */
  uploadProfilePictureChunked: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('fileName', file.name);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('totalChunks', totalChunks.toString());

      const response = await api.post(`${API_BASE_URL}/profile-picture-chunk`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (onProgress) {
        // Calculate progress based on chunks uploaded so far
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        onProgress(progress);
      }

      const data = response.data;
      if (data.completed) {
        return data.profilePictureUrl;
      }
    }

    throw new Error('Upload failed or did not complete.');
  }
};
