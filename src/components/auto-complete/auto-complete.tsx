import {
  Component,
  Prop,
  State,
  Watch,
  Event,
  EventEmitter,
  FunctionalComponent
} from "@stencil/core";
import {
  PlaceService,
  Prediction,
  GoogleMapsObject,
  FieldWithData,
  AutocompleteService
} from "./definitions/auto-complete";
import { debounce } from "throttle-debounce";

interface PredictionListProps {
  predictions: Array<Prediction>;
  handleClick: Function;
  visible: Boolean;
}

const PredictionList: FunctionalComponent<PredictionListProps> = ({
  predictions,
  handleClick,
  visible
}) => (
  <ul class={`${visible ? "" : "hidden"}`}>
    {predictions &&
      predictions.map(prediction => (
        <li key={prediction.id} onClick={() => handleClick(prediction)}>
          {prediction.description}
        </li>
      ))}
  </ul>
);

/**
 * Usage: `auto-complete`
 * Required props:
 *  - autocompleteIdentifier: string - Used to tag up the fields that are returned.
 *  - name: string - Adds name proeprty to input.
 */
@Component({
  tag: "auto-complete",
  styleUrl: "./auto-complete.css",
  shadow: true
})
export class AutoComplete {
  constructor() {
    this.callAutoComplete = debounce(300, this.callAutoComplete);
  }

  placeService: PlaceService = {};
  sessionToken: any = {};
  serviceLoaded: boolean = false;

  @State() predictions: Array<Prediction> = [];
  @State() currentCountryIso: string;
  @State() dropdownVisible: boolean = false;
  @State() service: AutocompleteService;
  @State() google: GoogleMapsObject;
  @State() street: string;
  @State() changedPlace: object = {};

  @Prop() autocompleteIdentifier: string;
  @Prop() name: string;

  @Event() placeChange: EventEmitter;

  @Watch("service")
  serviceWatchHandler(newVal: boolean) {
    if (newVal) {
      this.serviceLoaded = true;
    }
  }

  render() {
    return (
      <div class={`autocomplete-wrapper${this.dropdownVisible ? " open" : ""}`}>
        <input
          type="text"
          name={this.name}
          id={this.name}
          onInput={this.handleInput}
          onKeyUp={this.callAutoComplete}
          onBlur={this.hideDropdown}
          onFocus={this.showDropdown}
          value={this.street}
        />
        <PredictionList
          visible={this.dropdownVisible}
          predictions={this.predictions}
          handleClick={this.emulatePlaceChange}
        />
      </div>
    );
  }

  componentWillLoad() {
    return new Promise((resolve, reject) => {
      let i = 0;
      (function wait() {
        i++;
        if (i > 200)
          return reject(
            "Timeout, make sure the Google Maps API is loaded globally."
          );
        if (window.google) return resolve();
        setTimeout(wait, 30);
      })();
    });
  }

  componentDidLoad() {
    this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    this.service = new window.google.maps.places.AutocompleteService();
    this.placeService = new window.google.maps.places.PlacesService(
      document.createElement("div") // Requires an element to "bind" to
    );
  }

  private showDropdown = () => {
    if (this.predictions.length > 0) {
      this.dropdownVisible = true;
    }
  };

  private hideDropdown = () => {
    this.dropdownVisible = false;
  };

  private fillPostcode = (tempPostcode, comp) => {
    if (comp.types.indexOf("postal_code") !== -1) {
      tempPostcode.main = comp.short_name;
    } else if (comp.types.indexOf("postal_code_prefix") !== -1) {
      tempPostcode.prefix = comp.short_name;
    } else if (comp.types.indexOf("postal_code_suffix") !== -1) {
      tempPostcode.suffix = comp.short_name;
    }
  };

  private fillStreet = (tempStreet, comp) => {
    if (comp.types.indexOf("street_number") !== -1) {
      tempStreet.unshift(comp.short_name);
    }

    if (comp.types.indexOf("route") !== -1) {
      tempStreet.push(comp.long_name);
    }

    if (tempStreet.length) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_street`,
        data: tempStreet.join(" ")
      });
    } else {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_street`,
        data: ""
      });
    }
  };

  private fillState = (filledFields, comp) => {
    if (comp.types.indexOf("administrative_area_level_2") !== -1) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_state`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_state`] = true;
    } else if (
      comp.types.indexOf("administrative_area_level_1") !== -1 &&
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
        data: ""
      });
    }
  };

  private fillCity = (filledFields, comp) => {
    if (comp.types.indexOf("locality") !== -1) {
      this.setField({
        identifier: `${this.autocompleteIdentifier}_city`,
        data: comp.long_name
      });
      filledFields[`${this.autocompleteIdentifier}_city`] = true;
    } else if (
      comp.types.indexOf("postal_town") !== -1 &&
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
        data: ""
      });
    }
  };

  private setPlaces = (components: Array<any>): void => {
    console.log(components);
    let tempStreet = [];
    let tempPostcode = {
      prefix: "",
      main: "",
      suffix: ""
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

    let finalPostcode = "";
    Object.keys(tempPostcode).forEach(key => {
      finalPostcode += `${tempPostcode[key]} `;
    });

    this.setField({
      identifier: `${this.autocompleteIdentifier}_postcode`,
      data: finalPostcode.trim()
    });

    console.log("will emit");

    this.placeChange.emit(this.changedPlace);

    this.dropdownVisible = false;
    this.predictions = [];
  };

  emulatePlaceChange = (opt): any => {
    console.log("click trigger");
    this.placeService.getDetails(
      {
        placeId: opt.place_id,
        fields: ["address_component"]
      },
      (place: any, status: string) => {
        if (status == window.google.maps.places.PlacesServiceStatus.OK) {
          console.log("service ok");
          this.setPlaces(place.address_components);
        } else {
          console.log(status);
        }
      }
    );
  };

  private setField = (field: FieldWithData) => {
    const { identifier, data } = field;
    this.changedPlace = Object.assign(this.changedPlace, {
      [identifier]: data
    });
  };

  private handleInput = (e: any): any => {
    this.street = e.target.value;
  };

  private callAutoComplete = (): any => {
    if (this.street !== "") {
      let componentRestrictions = this.currentCountryIso
        ? { country: this.currentCountryIso }
        : {};
      this.serviceLoaded &&
        this.service.getPlacePredictions(
          {
            input: this.street,
            componentRestrictions,
            sessionToken: this.sessionToken,
            types: ["address"]
          },
          (predictions, status) => {
            if (status != window.google.maps.places.PlacesServiceStatus.OK) {
              return;
            }

            this.dropdownVisible = true;
            this.predictions = predictions;
          }
        );
    } else {
      this.dropdownVisible = false;
      this.predictions = [];
    }
  };
}
