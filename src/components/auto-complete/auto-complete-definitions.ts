export declare const Window: any

export interface PlaceService {
    getDetails?(options: object, callback: (place: object, status: string) => void);
}

export interface Prediction {
    id: string,
    description: string
}

export interface GoogleMapsObject {
    maps?: any
}

export interface FieldWithData {
    identifier: string,
    data: string
}

export interface AutocompleteService {
    getPlacePredictions?(options: object, callback: (predictions: Array<Prediction>, status: string) => void)
}