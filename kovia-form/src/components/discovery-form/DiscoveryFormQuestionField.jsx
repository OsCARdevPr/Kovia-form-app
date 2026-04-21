import { Controller } from 'react-hook-form';
import { IMaskInput } from 'react-imask';
import {
  buildMaskOptions,
  formatSliderValue,
  getFieldTypeDefinition,
  isQuestionVisible,
  normalizeSliderConfig,
  resolvePlaceholder,
  toFiniteNumber,
} from './formUtils';

export default function DiscoveryFormQuestionField({
  question,
  stepOrder,
  dynamicConfig,
  methods,
  watchedValues,
}) {
  const fieldTypeDefinition = getFieldTypeDefinition(question, dynamicConfig);
  const questionType = fieldTypeDefinition.key;
  const placeholder = resolvePlaceholder(question, fieldTypeDefinition);
  const maskOptions = buildMaskOptions(question, fieldTypeDefinition);
  const sliderConfig = questionType === 'price' ? normalizeSliderConfig(question) : null;

  const visible = isQuestionVisible(question, watchedValues || {});
  if (!visible) return null;

  const error = methods.formState.errors?.[question.id]?.message;
  const inputId = `field-${stepOrder}-${question.id}`;

  const renderLabel = () => (
    <label className="form-label" htmlFor={questionType === 'radio' || questionType === 'checkbox' ? undefined : inputId}>
      {question.label} {question.required ? <span className="required">*</span> : null}
      {question.hint ? <span className="label-hint">{question.hint}</span> : null}
    </label>
  );

  if (questionType === 'radio') {
    return (
      <div className="form-group" data-field={question.id} key={question.id}>
        {renderLabel()}
        <div className={`radio-group ${error ? 'group-error' : ''}`}>
          {(question.options || []).map((option, index) => (
            <div className="radio-option" key={`${question.id}-${option}`}>
              <input
                type="radio"
                id={`${inputId}-${index + 1}`}
                value={option}
                {...methods.register(question.id)}
              />
              <label htmlFor={`${inputId}-${index + 1}`}>{option}</label>
            </div>
          ))}
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  if (questionType === 'checkbox') {
    return (
      <div className="form-group" data-field={question.id} data-type="checkbox" key={question.id}>
        {renderLabel()}
        <div className={`checkbox-group ${error ? 'group-error' : ''}`}>
          {(question.options || []).map((option, index) => (
            <div className="checkbox-option" key={`${question.id}-${option}`}>
              <input
                type="checkbox"
                id={`${inputId}-${index + 1}`}
                value={option}
                {...methods.register(question.id)}
              />
              <label htmlFor={`${inputId}-${index + 1}`}>{option}</label>
            </div>
          ))}
        </div>
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  if (questionType === 'textarea') {
    return (
      <div className="form-group" data-field={question.id} key={question.id}>
        {renderLabel()}
        <textarea
          id={inputId}
          className={`form-textarea ${error ? 'input-error' : ''}`}
          placeholder={placeholder}
          {...methods.register(question.id)}
        />
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  if (questionType === 'select') {
    return (
      <div className="form-group" data-field={question.id} key={question.id}>
        {renderLabel()}
        <select id={inputId} className={`form-input ${error ? 'input-error' : ''}`} {...methods.register(question.id)}>
          <option value="">{placeholder || 'Selecciona una opción'}</option>
          {(question.options || []).map((option) => (
            <option key={`${question.id}-${option}`} value={option}>{option}</option>
          ))}
        </select>
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  if (sliderConfig) {
    return (
      <div className="form-group" data-field={question.id} data-type="price-slider" key={question.id}>
        {renderLabel()}
        <Controller
          name={question.id}
          control={methods.control}
          render={({ field }) => {
            const parsedValue = toFiniteNumber(field.value, sliderConfig.min);
            const boundedValue = Math.min(
              sliderConfig.max,
              Math.max(sliderConfig.min, parsedValue),
            );

            const rangeText = `${sliderConfig.min} - ${sliderConfig.max}`;

            return (
              <div className={`form-slider ${error ? 'group-error' : ''}`}>
                <div className="form-slider-header">
                  <span className="form-slider-value">{formatSliderValue(boundedValue, sliderConfig)}</span>
                  <span className="form-slider-range">{rangeText}</span>
                </div>

                <input
                  id={inputId}
                  type="range"
                  min={sliderConfig.min}
                  max={sliderConfig.max}
                  step={sliderConfig.step}
                  value={boundedValue}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(String(event.target.value))}
                  className="form-range-input"
                />

                {sliderConfig.marks.length > 0 ? (
                  <div className="form-slider-marks" aria-hidden="true">
                    {sliderConfig.marks.map((mark, markIndex) => {
                      const relativePosition = ((mark.value - sliderConfig.min) / (sliderConfig.max - sliderConfig.min)) * 100;
                      const safePosition = Math.min(100, Math.max(0, relativePosition));

                      return (
                        <span
                          key={`${question.id}-mark-${markIndex}-${mark.value}`}
                          className="form-slider-mark"
                          style={{ left: `${safePosition}%` }}
                        >
                          {mark.label}
                        </span>
                      );
                    })}
                  </div>
                ) : null}

                {sliderConfig.confirmLabel ? (
                  <p className="form-slider-confirm">{sliderConfig.confirmLabel}</p>
                ) : null}
              </div>
            );
          }}
        />
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  if (maskOptions) {
    return (
      <div className="form-group" data-field={question.id} data-type={questionType} key={question.id}>
        {renderLabel()}
        <Controller
          name={question.id}
          control={methods.control}
          render={({ field }) => (
            <IMaskInput
              {...maskOptions}
              id={inputId}
              value={typeof field.value === 'string' ? field.value : ''}
              inputRef={field.ref}
              onBlur={field.onBlur}
              className={`form-input ${error ? 'input-error' : ''}`}
              placeholder={placeholder}
              onAccept={(value) => field.onChange(value ?? '')}
            />
          )}
        />
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }

  const htmlInputType = fieldTypeDefinition?.html_input_type || 'text';

  return (
    <div className="form-group" data-field={question.id} key={question.id}>
      {renderLabel()}
      <input
        id={inputId}
        type={htmlInputType === 'email' || htmlInputType === 'tel' ? htmlInputType : 'text'}
        className={`form-input ${error ? 'input-error' : ''}`}
        placeholder={placeholder}
        {...methods.register(question.id)}
      />
      {error ? <div className="error-message">{error}</div> : null}
    </div>
  );
}
