export type Brand =
  | "Mercedes-Benz"
  | "Volvo"
  | "Scania"
  | "MAN"
  | "DAF"
  | "Iveco";

export type BodyType =
  | "curtain"
  | "reefer"
  | "tanker"
  | "container"
  | "flatbed"
  | "tipper";

export type Status = "active" | "waiting" | "inactive";

export type RequestKind = "truck" | "cargo" | "repair" | "driver" | "report";

export interface Stop {
  name: string;
  place: string;
  done: boolean;
}

export interface Driver {
  name: string;
  phone: string;
  initials: string;
  rating: number;
  trips: number;
}

export interface Comment {
  from: "driver" | "me";
  text: string;
  time: string;
}

export interface PhotoReport {
  src: string;
  caption: string;
}

export interface Vehicle {
  id: string;
  shipment: string;
  brand: Brand;
  model: string;
  cab: string;
  body: BodyType;
  status: Status;
  hp: number;
  odometer: number;
  year: number;
  plate: string;
  fuel: number;
  engineTemp: number;
  boxTemp?: number;
  load: number;
  maxLoad: number;
  speed: number;
  etaMinutes: number;
  milesLeft: number;
  progress: number;
  driver: Driver;
  partner: string;
  from: string;
  to: string;
  stops: Stop[];
  route: string;
  photos: number[];
  comments: Comment[];
  docs: DocState[];
}

export interface DocState {
  name: string;
  meta: string;
  state: "idle" | "loading" | "done";
}

export interface RouteShape {
  key: string;
  points: [number, number][];
  areas: { label: string; x: number; y: number; size: number }[];
}
