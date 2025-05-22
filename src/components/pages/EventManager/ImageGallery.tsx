import React from "react";

interface ImageGalleryProps {
  images: { url: string; is_primary: boolean }[];
  eventTitle: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  eventTitle,
}) => {
  if (images.length <= 1) return null;

  return (
    <div className="grid grid-cols-4 gap-2">
      {images.slice(0, 4).map((img, index) => (
        <div key={index} className="relative aspect-square">
          <img
            src={img.url}
            alt={`${eventTitle} image ${index + 1}`}
            className={`w-full h-full object-cover rounded-lg ${
              img.is_primary ? "ring-2 ring-indigo-500" : ""
            }`}
          />
          {/* Removed the Primary tag div */}
        </div>
      ))}
      {images.length > 4 && (
        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 text-sm">+{images.length - 4}</span>
        </div>
      )}
    </div>
  );
};
