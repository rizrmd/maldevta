import { create } from "zustand";

export type FileAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  uploadProgress?: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
};

interface FileStore {
  // State
  files: FileAttachment[];
  isDragging: boolean;
  uploadProgress: number | null;

  // Actions
  setFiles: (files: FileAttachment[] | ((prev: FileAttachment[]) => FileAttachment[])) => void;
  addFile: (file: File) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  setIsDragging: (isDragging: boolean) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  updateFileStatus: (
    fileId: string,
    status: FileAttachment["status"],
    error?: string
  ) => void;
  setUploadProgress: (progress: number | null) => void;
}

export const useFileStore = create<FileStore>((set) => ({
  // Initial state
  files: [],
  isDragging: false,
  uploadProgress: null,

  // Actions
  setFiles: (files) =>
    set((state) => ({
      files: typeof files === "function" ? files(state.files) : files,
    })),

  addFile: (file) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileAttachment: FileAttachment = {
      id: fileId,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "pending",
    };

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        set((state) => ({
          files: state.files.map((f) =>
            f.id === fileId ? { ...f, preview: e.target?.result as string } : f
          ),
        }));
      };
      reader.readAsDataURL(file);
    }

    set((state) => ({ files: [...state.files, fileAttachment] }));
  },

  removeFile: (fileId) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== fileId),
    })),

  clearFiles: () => set({ files: [], uploadProgress: null }),

  setIsDragging: (isDragging) => set({ isDragging }),

  updateFileProgress: (fileId, progress) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, uploadProgress: progress } : f
      ),
    })),

  updateFileStatus: (fileId, status, error) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === fileId ? { ...f, status, error } : f
      ),
    })),

  setUploadProgress: (progress) => set({ uploadProgress: progress }),
}));
