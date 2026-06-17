import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { Error } from '#components/alerts';
import { Link } from '#components/common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { FormField, FormLabel } from '#components/forms';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { getSecretsError } from '#util/error';

type RedbarkInitialiseModalProps = Extract<
  ModalType,
  { name: 'redbark-init' }
>['options'];

export function RedbarkInitialiseModal({
  onSuccess,
}: RedbarkInitialiseModalProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    t('It is required to provide an API key.'),
  );

  const onSubmit = async (close: () => void) => {
    if (!apiKey) {
      setIsValid(false);
      return;
    }

    setIsLoading(true);

    const { error, reason } =
      (await send('secret-set', {
        name: 'redbark_apiKey',
        value: apiKey,
      })) || {};

    if (error) {
      setIsLoading(false);
      setIsValid(false);
      setError(getSecretsError(error, reason));
      return;
    }

    setIsValid(true);
    onSuccess();
    setIsLoading(false);
    close();
  };

  return (
    <Modal name="redbark-init" containerProps={{ style: { width: 300 } }}>
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Set-up Redbark')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ display: 'flex', gap: 10 }}>
            <Text>
              <Trans>
                In order to enable bank sync via Redbark (for Australian and New
                Zealand banks), you will need an API key. This can be created in
                the{' '}
                <Link
                  variant="external"
                  to="https://app.redbark.com/settings"
                  linkColor="purple"
                >
                  Redbark dashboard
                </Link>
                .
              </Trans>
            </Text>

            <FormField>
              <FormLabel title={t('API key:')} htmlFor="redbark-api-key" />
              <Input
                id="redbark-api-key"
                type="password"
                value={apiKey}
                onChangeValue={value => {
                  setApiKey(value);
                  setIsValid(true);
                }}
              />
            </FormField>

            {!isValid && <Error>{error}</Error>}
          </View>

          <ModalButtons>
            <ButtonWithLoading
              variant="primary"
              autoFocus
              isLoading={isLoading}
              onPress={() => {
                void onSubmit(() => state.close());
              }}
            >
              <Trans>Save and continue</Trans>
            </ButtonWithLoading>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
}
