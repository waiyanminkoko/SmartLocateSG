// ---------- TRANSPORT ----------

export type MrtExit = {
  id: number;
  station_name: string;
  exit_number: string;
  latitude: number;
  longitude: number;
};

export type BusStop = {
  id: number;
  bus_stop_number: string;
  latitude: number;
  longitude: number;
};