import { Component, Prop, State, Watch } from '@stencil/core';
import {
  PlaceService,
  Prediction,
  GoogleMapsObject,
  FieldWithData,
  AutocompleteService
} from './auto-complete-definitions';
import { debounce } from 'throttle-debounce';

declare global {
  interface Window {
    google: any;
  }
}

@Component({
  tag: 'auto-complete',
  styleUrl: 'auto-complete.css',
  shadow: true
})
export class AutoComplete {
  constructor() {
    this.callAutoComplete = debounce(300, this.callAutoComplete);
  }

  placeService: PlaceService = {};
  sessionToken: any = {};
  serviceLoaded: boolean = false;
  googleObjectLoaded: boolean = false;

  @State() predictions: Array<Prediction>;
  @State() currentCountryIso: string;
  @State() dropdownVisible: boolean;
  @State() service: AutocompleteService;
  @State() google: GoogleMapsObject;
  @State() street: string;

  @Prop() apiKey: string;
  @Prop() autocompleteIdentifier: string;

  @Watch('service')
  serviceWatchHandler(newVal: boolean) {
    if (newVal) {
      this.serviceLoaded = true;
    }
  }

  componentDidLoad() {
    this.init().then(
      () => {
        this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
        this.service = new window.google.maps.places.AutocompleteService();
        this.placeService = new window.google.maps.places.PlacesService(
          document.createElement('div') // Requires an element to "bind" to
        );
      },
      err => {
        console.log(err);
      }
    );
  }

  private init = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      this.injectSDK().then(
        () => {
          resolve(true);
        },
        err => {
          reject(err);
        }
      );
    });
  };

  private injectSDK = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      window['placesLoaded'] = () => {
        this.googleObjectLoaded = true;
        resolve(true);
      };

      let script = document.createElement('script');
      script.id = 'googleMaps';

      if (this.apiKey) {
        script.src = `https://maps.googleapis.com/maps/api/js?key=${
          this.apiKey
        }&libraries=places&callback=placesLoaded`;
        document.body.appendChild(script);
      } else {
        reject('API Key not supplied');
      }
    });
  };

  render() {
    return (
      <div class="autocomplete-wrapper">
        <input
          type="text"
          onInput={this.handleInput}
          onKeyUp={this.callAutoComplete}
        />
        <ul
          class={`autocomplete-dropdown${
            this.dropdownVisible ? '' : ' hidden'
          }`}
        >
          {this.predictions &&
            this.predictions.map(prediction => (
              <li
                key={prediction.id}
                onClick={() => this.emulatePlaceChange(prediction)}
              >
                {prediction.description}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  private fillPostcode = (tempPostcode, comp) => {
    if (comp.types.indexOf('postal_code') !== -1) {
      tempPostcode.main = comp.short_name;
    } else if (comp.types.indexOf('postal_code_prefix') !== -1) {
      tempPostcode.prefix = comp.short_name;
    } else if (comp.types.indexOf('postal_code_suffix') !== -1) {
      tempPostcode.suffix = comp.short_name;
    }
  };

  private fillStreet = (tempStreet, comp) => {
    if (comp.types.indexOf('street_number') !== -1) {
      tempStreet.unshift(comp.short_name);
    }

    if (comp.types.indexOf('route') !== -1) {
      tempStreet.push(comp.long_name);
    }

    if (tempStreet.length) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_street`,
        data: tempStreet.join(' ')
      });
    } else {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_street`,
        data: ''
      });
    }
  };

  private fillState = (filledFields, comp) => {
    if (comp.types.indexOf('administrative_area_level_2') !== -1) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_state`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_state`] = true;
    } else if (
      comp.types.indexOf('administrative_area_level_1') !== -1 &&
      !filledFields[`${this.autocompleteIdentifier}_state`]
    ) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_state`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_state`] = true;
    } else if (!filledFields[`${this.autocompleteIdentifier}_state`]) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_state`,
        data: ''
      });
    }
  };

  private fillCity = (filledFields, comp) => {
    if (comp.types.indexOf('locality') !== -1) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_city`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_city`] = true;
    } else if (
      comp.types.indexOf('postal_town') !== -1 &&
      !filledFields[`${this.autocompleteIdentifier}_city`]
    ) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_city`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_city`] = true;
    } else if (!filledFields[`${this.autocompleteIdentifier}_city`]) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_city`,
        data: ''
      });
    }
  };

  private setPlaces = (components: Array<any>): void => {
    let tempStreet = [];
    let tempPostcode = {
      prefix: '',
      main: '',
      suffix: ''
    };

    let filledFields = {
      [`${this.autocompleteIdentifier}_postcode`]: false,
      [`${this.autocompleteIdentifier}_street`]: false,
      [`${this.autocompleteIdentifier}_state`]: false,
      [`${this.autocompleteIdentifier}_city`]: false
    };

    components.forEach(comp => {
      this.fillPostcode(tempPostcode, comp);
      this.fillStreet(tempStreet, comp);
      this.fillState(filledFields, comp);
      this.fillCity(filledFields, comp);
    });

    let finalPostcode = '';
    Object.keys(tempPostcode).forEach(key => {
      finalPostcode += `${tempPostcode[key]} `;
    });

    this.setField({
      identifier: `${this.autocompleteIdentifier}_postcode`,
      data: finalPostcode.trim()
    });

    this.predictions = [];
  };

  private emulatePlaceChange = (opt): any => {
    this.placeService.getDetails(
      {
        placeId: opt.place_id,
        fields: ['address_component']
      },
      (place: any, status: string) => {
        if (status == window.google.maps.places.PlacesServiceStatus.OK) {
          this.setPlaces(place.address_components);
        } else {
          console.log(status);
        }
      }
    );
  };

  private setField = (field: FieldWithData) => {
    return field;
  };

  private handleInput = (e: any): any => {
    this.street = e.target.value;
  };

  private callAutoComplete = (): any => {
    if (this.street !== '') {
      let componentRestrictions = this.currentCountryIso
        ? { country: this.currentCountryIso }
        : {};
      this.serviceLoaded &&
        this.service.getPlacePredictions(
          {
            input: this.street,
            componentRestrictions,
            sessionToken: this.sessionToken,
            types: ['address']
          },
          (predictions, status) => {
            if (status != window.google.maps.places.PlacesServiceStatus.OK) {
              return;
            }

            this.predictions = predictions;
          }
        );
    }
  };
}
