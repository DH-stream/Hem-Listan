export type UserCoordinates = {
  latitude: number;
  longitude: number;
};

const GEOLOCATION_TIMEOUT_MS = 3_500;

export function getCurrentUserPosition(): Promise<UserCoordinates> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Browser geolocation is not supported"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied"
            : error.code === error.TIMEOUT
              ? "Location request timed out"
              : "Location unavailable";
        reject(new Error(message));
      },
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 5 * 60 * 1000,
      },
    );
  });
}
