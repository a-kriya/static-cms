import { isEqual } from 'lodash';
import isEmpty from 'lodash/isEmpty';
import React, { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { translate } from 'react-polyglot';
import { connect } from 'react-redux';

import {
  changeDraftField as changeDraftFieldAction,
  changeDraftFieldValidation,
} from '@staticcms/core/actions/entries';
import { query as queryAction } from '@staticcms/core/actions/search';
import useDebouncedCallback from '@staticcms/core/lib/hooks/useDebouncedCallback';
import useMemoCompare from '@staticcms/core/lib/hooks/useMemoCompare';
import useUUID from '@staticcms/core/lib/hooks/useUUID';
import { isFieldDuplicate, isFieldHidden } from '@staticcms/core/lib/i18n';
import { resolveWidget } from '@staticcms/core/lib/registry';
import classNames from '@staticcms/core/lib/util/classNames.util';
import { fileForEntry } from '@staticcms/core/lib/util/collection.util';
import { getFieldLabel, useHidden } from '@staticcms/core/lib/util/field.util';
import { isNotNullish } from '@staticcms/core/lib/util/null.util';
import { validate } from '@staticcms/core/lib/util/validation.util';
import { selectFieldErrors } from '@staticcms/core/reducers/selectors/entryDraft';
import { selectTheme } from '@staticcms/core/reducers/selectors/globalUI';
import { selectIsLoadingAsset } from '@staticcms/core/reducers/selectors/medias';
import { useAppDispatch, useAppSelector } from '@staticcms/core/store/hooks';

import type {
  Field,
  FieldsErrors,
  I18nSettings,
  TranslatedProps,
  UnknownField,
  ValueOrNestedValue,
  Widget,
} from '@staticcms/core/interface';
import type { RootState } from '@staticcms/core/store';
import type { ComponentType } from 'react';
import type { ConnectedProps } from 'react-redux';

const EditorControl = ({
  collection,
  collectionFile,
  config: configState,
  entry,
  field,
  fieldsErrors,
  submitted,
  disabled = false,
  parentDuplicate = false,
  locale,
  parentPath,
  query,
  t,
  value,
  forList = false,
  forSingleList = false,
  changeDraftField,
  i18n,
  fieldName,
  isMeta = false,
  controlled = false,
}: TranslatedProps<EditorControlProps>) => {
  const dispatch = useAppDispatch();

  const id = useUUID();

  const widgetName = field.widget;
  const widget = resolveWidget(widgetName) as Widget<ValueOrNestedValue>;

  const theme = useAppSelector(selectTheme);

  const path = useMemo(
    () =>
      parentPath.length > 0 ? `${parentPath}.${fieldName ?? field.name}` : fieldName ?? field.name,
    [field.name, fieldName, parentPath],
  );

  const [dirty, setDirty] = useState(!isEmpty(widget.getValidValue(value, field as UnknownField)));

  const fieldErrorsSelector = useMemo(
    () => selectFieldErrors(path, i18n, isMeta),
    [i18n, isMeta, path],
  );
  const errors = useAppSelector(fieldErrorsSelector);

  const hasErrors = (submitted || dirty) && Boolean(errors.length);

  const duplicate = useMemo(
    () => parentDuplicate || isFieldDuplicate(field, locale, i18n?.defaultLocale),
    [field, i18n?.defaultLocale, parentDuplicate, locale],
  );
  const i18nDisabled = useMemo(
    () => isFieldHidden(field, locale, i18n?.defaultLocale),
    [field, i18n?.defaultLocale, locale],
  );
  const hidden = useHidden(field, entry);

  useEffect(() => {
    if (hidden) {
      dispatch(changeDraftFieldValidation(path, [], i18n, isMeta));
      return;
    }

    if ((!dirty && !submitted) || disabled || i18nDisabled) {
      return;
    }

    const validateValue = async () => {
      const errors = await validate(field, value, widget, t);
      dispatch(changeDraftFieldValidation(path, errors, i18n, isMeta));
    };

    validateValue();
  }, [
    dirty,
    dispatch,
    field,
    i18n,
    hidden,
    path,
    submitted,
    t,
    value,
    widget,
    disabled,
    isMeta,
    i18nDisabled,
  ]);

  const handleChangeDraftField = useCallback(
    async (value: ValueOrNestedValue) => {
      setDirty(
        oldDirty => oldDirty || !isEmpty(widget.getValidValue(value, field as UnknownField)),
      );

      changeDraftField({ path, field, value, i18n, isMeta });
    },
    [changeDraftField, field, i18n, isMeta, path, widget],
  );

  const handleDebouncedChangeDraftField = useDebouncedCallback(handleChangeDraftField, 250);

  const config = useMemo(() => configState.config, [configState.config]);

  const finalValue = useMemoCompare(value, isEqual);

  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (isNotNullish(finalValue)) {
      return;
    }

    if ('default' in field && isNotNullish(!field.default)) {
      if (widget.getDefaultValue) {
        handleDebouncedChangeDraftField(
          widget.getDefaultValue(field.default, field as unknown as UnknownField),
        );
      } else {
        handleDebouncedChangeDraftField(field.default);
      }
      setVersion(version => version + 1);
      return;
    }

    if (widget.getDefaultValue) {
      handleDebouncedChangeDraftField(
        widget.getDefaultValue(null, field as unknown as UnknownField),
      );
      setVersion(version => version + 1);
    }
  }, [field, finalValue, handleDebouncedChangeDraftField, widget]);

  return useMemo(() => {
    if (!collection || !entry || !config || field.widget === 'hidden') {
      return null;
    }

    return (
      <div className={classNames(hidden && 'hidden')}>
        {createElement(widget.control, {
          key: `${id}-${version}`,
          collection,
          collectionFile,
          config,
          entry,
          field: field as UnknownField,
          fieldsErrors,
          submitted,
          disabled: disabled || duplicate || hidden || i18nDisabled,
          duplicate,
          label: getFieldLabel(field, t),
          locale,
          onChange: handleDebouncedChangeDraftField,
          path,
          query,
          t,
          value: finalValue,
          forList,
          forSingleList,
          i18n,
          hasErrors,
          errors,
          theme,
          controlled,
        })}
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    collection,
    config,
    field,
    hidden,
    widget.control,
    id,
    version,
    fieldsErrors,
    submitted,
    disabled,
    duplicate,
    t,
    locale,
    handleDebouncedChangeDraftField,
    path,
    query,
    finalValue,
    forList,
    forSingleList,
    i18n,
    hasErrors,
    errors,
  ]);
};

interface EditorControlOwnProps {
  field: Field;
  fieldsErrors: FieldsErrors;
  submitted: boolean;
  disabled?: boolean;
  parentDuplicate?: boolean;
  locale?: string;
  parentPath: string;
  value: ValueOrNestedValue;
  forList?: boolean;
  forSingleList?: boolean;
  i18n: I18nSettings | undefined;
  fieldName?: string;
  controlled?: boolean;
  isMeta?: boolean;
}

function mapStateToProps(state: RootState, ownProps: EditorControlOwnProps) {
  const { collections, entryDraft } = state;
  const entry = entryDraft.entry;
  const collection = entryDraft.entry ? collections[entryDraft.entry.collection] : null;
  const collectionFile = fileForEntry(collection, entryDraft.entry?.slug);
  const isLoadingAsset = selectIsLoadingAsset(state);

  return {
    ...ownProps,
    config: state.config,
    entry,
    collection,
    collectionFile,
    isLoadingAsset,
  };
}

const mapDispatchToProps = {
  changeDraftField: changeDraftFieldAction,
  query: queryAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type EditorControlProps = ConnectedProps<typeof connector>;

export default connector(translate()(EditorControl) as ComponentType<EditorControlProps>);
