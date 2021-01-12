// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import './lg.css';
import { jsx } from '@emotion/core';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import isEmpty from 'lodash/isEmpty';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn } from 'office-ui-fabric-react/lib/DetailsList';
import { ActionButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';
import { IconButton } from 'office-ui-fabric-react/lib/Button';
import { Icon } from 'office-ui-fabric-react/lib/Icon';
import { TooltipHost } from 'office-ui-fabric-react/lib/Tooltip';
import { ScrollablePane, ScrollbarVisibility } from 'office-ui-fabric-react/lib/ScrollablePane';
import { Sticky, StickyPositionType } from 'office-ui-fabric-react/lib/Sticky';
import formatMessage from 'format-message';
import { NeutralColors, FontSizes } from '@uifabric/fluent-theme';
import { RouteComponentProps } from '@reach/router';
import { LgTemplate } from '@bfc/shared';
import { useRecoilValue } from 'recoil';
import { lgUtil } from '@bfc/indexers';
import { Components, createDirectLine, createStore, hooks } from 'botframework-webchat';
import { useBoolean } from '@uifabric/react-hooks/lib/useBoolean';
import { Panel } from 'office-ui-fabric-react/lib/components/Panel/Panel';
import { TextField } from 'office-ui-fabric-react/lib/components/TextField/TextField';
import { Activity, ActivityFactory, MessageFactory } from 'botbuilder-core';

import { EditableField } from '../../components/EditableField';
import { navigateTo } from '../../utils/navigation';
import { actionButton, formCell, editableFieldContainer } from '../language-understanding/styles';
import {
  dispatcherState,
  lgFilesState,
  localeState,
  settingsState,
  validateDialogsSelectorFamily,
} from '../../recoilModel';
import { languageListTemplates } from '../../components/MultiLanguage';
import TelemetryClient from '../../telemetry/TelemetryClient';

interface TableViewProps extends RouteComponentProps<{ dialogId: string; skillId: string; projectId: string }> {
  projectId?: string;
  skillId?: string;
  dialogId?: string;
  lgFileId?: string;
}

const TableView: React.FC<TableViewProps> = (props) => {
  const { dialogId, projectId, skillId, lgFileId } = props;

  const actualProjectId = skillId ?? projectId ?? '';

  const lgFiles = useRecoilValue(lgFilesState(actualProjectId));
  const locale = useRecoilValue(localeState(actualProjectId));
  const settings = useRecoilValue(settingsState(actualProjectId));
  const dialogs = useRecoilValue(validateDialogsSelectorFamily(actualProjectId));
  const { createLgTemplate, copyLgTemplate, removeLgTemplate, setMessage, updateLgTemplate } = useRecoilValue(
    dispatcherState
  );

  const { languages, defaultLanguage } = settings;

  const file = lgFileId
    ? lgFiles.find(({ id }) => id === lgFileId)
    : lgFiles.find(({ id }) => id === `${dialogId}.${locale}`);

  const defaultLangFile = lgFileId
    ? lgFiles.find(({ id }) => id === lgFileId)
    : lgFiles.find(({ id }) => id === `${dialogId}.${defaultLanguage}`);

  const [templates, setTemplates] = useState<LgTemplate[]>([]);
  const listRef = useRef(null);

  const activeDialog = dialogs.find(({ id }) => id === dialogId);
  const lgProperty = useRef<string>('{}');
  const templateName = useRef<string | undefined>(undefined);
  const lgResult = useRef<Partial<Activity>>({});
  //const [focusedIndex, setFocusedIndex] = useState(0);
  const [isOpen, { setTrue: openPanel, setFalse: dismissPanel }] = useBoolean(false);
  useEffect(() => {
    if (!file || isEmpty(file)) return;

    setTemplates(file.templates);
  }, [file, activeDialog, actualProjectId]);

  const moreLabel = formatMessage('Actions');

  const onClickEdit = useCallback(
    (name: string) => {
      const baseURL = skillId == null ? `/bot/${projectId}/` : `/bot/${projectId}/skill/${skillId}/`;
      navigateTo(`${baseURL}language-generation/${dialogId}/edit?t=${encodeURIComponent(name)}`);
    },
    [dialogId, projectId, skillId]
  );

  const onCreateNewTemplate = useCallback(() => {
    if (file) {
      const newName = lgUtil.increaseNameUtilNotExist(file.templates, 'TemplateName');
      const payload = {
        projectId: actualProjectId,
        id: file.id,
        template: {
          name: newName,
          body: '-TemplateValue',
        } as LgTemplate,
      };
      createLgTemplate(payload);
    }
  }, [file, actualProjectId]);

  const onRemoveTemplate = useCallback(
    (name) => {
      if (file) {
        const payload = {
          id: file.id,
          templateName: name,
          projectId: actualProjectId,
        };
        removeLgTemplate(payload);
      }
    },
    [file, actualProjectId]
  );

  const onCopyTemplate = useCallback(
    (name) => {
      if (file) {
        const resolvedName = lgUtil.increaseNameUtilNotExist(file.templates, `${name}_Copy`);
        const payload = {
          id: file.id,
          fromTemplateName: name,
          toTemplateName: resolvedName,
          projectId: actualProjectId,
        };
        copyLgTemplate(payload);
      }
    },
    [file, actualProjectId]
  );

  const handleTemplateUpdate = useCallback(
    (templateName: string, template: LgTemplate) => {
      if (file) {
        const payload = {
          id: file.id,
          templateName,
          template,
          projectId: actualProjectId,
        };
        updateLgTemplate(payload);
      }
    },
    [file, actualProjectId]
  );

  const handleTemplateUpdateDefaultLocale = useCallback(
    (templateName: string, template: LgTemplate) => {
      if (defaultLangFile) {
        const payload = {
          id: defaultLangFile.id,
          templateName,
          template,
          projectId: actualProjectId,
        };
        updateLgTemplate(payload);
      }
    },
    [defaultLangFile, actualProjectId]
  );

  const getTemplatesMoreButtons = useCallback(
    (item) => {
      const buttons = [
        {
          key: 'edit',
          name: formatMessage('Edit'),
          onClick: () => {
            onClickEdit(item.name);
          },
        },
        {
          key: 'delete',
          name: formatMessage('Delete'),
          onClick: () => {
            setMessage('item deleted');
            onRemoveTemplate(item.name);
          },
        },
        {
          key: 'copy',
          name: formatMessage('Make a copy'),
          onClick: () => {
            setMessage('item copied');
            onCopyTemplate(item.name);
          },
        },
        {
          key: 'evaluate',
          name: formatMessage('Evaluate this template'),
          onClick: () => {
            templateName.current = item.name;
            openPanel();
          },
        },
      ];

      return buttons;
    },
    [activeDialog, templates, onClickEdit, onRemoveTemplate, onCopyTemplate, setMessage]
  );

  const getTableColums = useCallback((): IColumn[] => {
    const languagesList = languageListTemplates(languages, locale, defaultLanguage);
    const defaultLangTeamplate = languagesList.find((item) => item.locale === defaultLanguage);
    const currentLangTeamplate = languagesList.find((item) => item.locale === locale);
    // eslint-disable-next-line format-message/literal-pattern
    const currentLangResponsesHeader = formatMessage(`Responses - ${currentLangTeamplate?.language}`);
    // eslint-disable-next-line format-message/literal-pattern
    const defaultLangResponsesHeader = formatMessage(`Responses - ${defaultLangTeamplate?.language} (default)`);

    let tableColums = [
      {
        key: 'name',
        name: formatMessage('Name'),
        fieldName: 'name',
        minWidth: 100,
        maxWidth: 200,
        isResizable: true,
        data: 'string',
        onRender: (item) => {
          const displayName = `#${item.name}`;
          return (
            <div data-is-focusable css={formCell}>
              <EditableField
                ariaLabel={formatMessage(`Name is {name}`, { name: displayName })}
                containerStyles={editableFieldContainer}
                depth={0}
                id={displayName}
                name={displayName}
                value={displayName}
                onBlur={(_id, value) => {
                  const newValue = value?.trim().replace(/^#/, '');
                  if (newValue) {
                    handleTemplateUpdate(item.name, { ...item, name: newValue });
                  }
                }}
                onChange={() => {}}
              />
            </div>
          );
        },
      },
      {
        key: 'responses',
        name: formatMessage('Responses'),
        fieldName: 'responses',
        minWidth: 500,
        isResizable: true,
        data: 'string',
        onRender: (item) => {
          const text = item.body;
          return (
            <div data-is-focusable css={formCell}>
              <EditableField
                multiline
                ariaLabel={formatMessage(`Response is {response}`, { response: text })}
                containerStyles={editableFieldContainer}
                depth={0}
                id={text}
                name={text}
                value={text}
                onBlur={(_id, value) => {
                  const newValue = value?.trim();
                  if (newValue) {
                    // prefix with - to body
                    const fixedBody =
                      !newValue.startsWith('-') && !newValue.startsWith('[') ? `- ${newValue}` : newValue;
                    handleTemplateUpdate(item.name, { ...item, body: fixedBody });
                  }
                }}
                onChange={() => {}}
              />
            </div>
          );
        },
      },
      {
        key: 'responses-lang',
        name: currentLangResponsesHeader,
        fieldName: 'responses',
        minWidth: 300,
        maxWidth: 500,
        isResizable: true,
        data: 'string',
        onRender: (item) => {
          const text = item.body;
          return (
            <div data-is-focusable css={formCell}>
              <EditableField
                multiline
                ariaLabel={formatMessage(`Response is {response}`, { response: text })}
                containerStyles={editableFieldContainer}
                depth={0}
                id={text}
                name={text}
                value={text}
                onBlur={(_id, value) => {
                  const newValue = value?.trim();
                  if (newValue) {
                    // prefix with - to body
                    const fixedBody =
                      !newValue.startsWith('-') && !newValue.startsWith('[') ? `- ${newValue}` : newValue;
                    handleTemplateUpdate(item.name, { ...item, body: fixedBody });
                  }
                }}
                onChange={() => {}}
              />
            </div>
          );
        },
      },
      {
        key: 'responses-default-lang',
        name: defaultLangResponsesHeader,
        fieldName: 'responses-default-lang',
        minWidth: 300,
        isResizable: true,
        data: 'string',
        onRender: (item) => {
          const text = item[`body-${defaultLanguage}`];
          return (
            <div data-is-focusable css={formCell}>
              <EditableField
                multiline
                ariaLabel={formatMessage(`Response is {response}`, { response: text })}
                containerStyles={editableFieldContainer}
                depth={0}
                id={text}
                name={text}
                value={text}
                onBlur={(_id, value) => {
                  const newValue = value?.trim();
                  if (newValue) {
                    // prefix with - to body
                    const fixedBody =
                      !newValue.startsWith('-') && !newValue.startsWith('[') ? `- ${newValue}` : newValue;
                    handleTemplateUpdateDefaultLocale(item.name, { ...item, body: fixedBody });
                  }
                }}
                onChange={() => {}}
              />
            </div>
          );
        },
      },
      {
        key: 'beenUsed',
        name: formatMessage('Been used'),
        fieldName: 'beenUsed',
        minWidth: 100,
        maxWidth: 100,
        isResizable: true,
        isCollapsable: true,
        data: 'string',
        onRender: (item) => {
          return activeDialog?.lgTemplates.find(({ name }) => name === item.name) ? (
            <Icon
              ariaLabel={formatMessage('Used') + ';'}
              iconName={'Accept'}
              styles={{
                root: {
                  fontSize: '16px',
                  paddingTop: '8px',
                },
              }}
            />
          ) : (
            <div data-is-focusable aria-label={formatMessage('Unused') + ';'} />
          );
        },
      },
      {
        key: 'buttons',
        name: '',
        minWidth: 50,
        maxWidth: 50,
        fieldName: 'buttons',
        data: 'string',
        onRender: (item) => {
          return (
            <TooltipHost calloutProps={{ gapSpace: 10 }} content={moreLabel}>
              <IconButton
                ariaLabel={moreLabel}
                menuIconProps={{ iconName: 'MoreVertical' }}
                menuProps={{
                  shouldFocusOnMount: true,
                  items: getTemplatesMoreButtons(item),
                }}
                styles={{ menuIcon: { color: NeutralColors.black, fontSize: FontSizes.size16 } }}
              />
            </TooltipHost>
          );
        },
      },
    ];

    // show compairable column when current lang is not default lang
    if (locale === defaultLanguage) {
      tableColums = tableColums.filter(
        ({ key }) => ['responses-default-lang', 'responses-lang'].includes(key) === false
      );
    } else {
      tableColums = tableColums.filter(({ key }) => ['responses'].includes(key) === false);
    }
    // when is not common, show beenUsed column
    if (!activeDialog) {
      tableColums = tableColums.filter(({ key }) => ['beenUsed'].includes(key) === false);
    }

    return tableColums;
  }, [
    languages,
    locale,
    defaultLanguage,
    handleTemplateUpdate,
    handleTemplateUpdateDefaultLocale,
    getTemplatesMoreButtons,
    activeDialog,
    actualProjectId,
  ]);

  const onRenderDetailsHeader = useCallback((props, defaultRender) => {
    return (
      <div data-testid="tableHeader">
        <Sticky isScrollSynced stickyPosition={StickyPositionType.Header}>
          {defaultRender({
            ...props,
            onRenderColumnHeaderTooltip: (tooltipHostProps) => <TooltipHost {...tooltipHostProps} />,
          })}
        </Sticky>
      </div>
    );
  }, []);

  const onRenderDetailsFooter = useCallback(() => {
    return (
      <div data-testid="tableFooter">
        <ActionButton
          css={actionButton}
          iconProps={{ iconName: 'CirclePlus' }}
          onClick={() => {
            onCreateNewTemplate();
            setMessage(formatMessage('item added'));
            TelemetryClient.track('NewTemplateAdded');
          }}
        >
          {formatMessage('New template')}
        </ActionButton>
      </div>
    );
  }, [activeDialog, templates]);

  const getKeyCallback = useCallback((item) => item.name, []);

  const templatesToRender = useMemo(() => {
    if (locale !== defaultLanguage) {
      return templates.map((item) => {
        const itemInDefaultLang = defaultLangFile?.templates?.find(({ name }) => name === item.name);
        return {
          ...item,
          [`body-${defaultLanguage}`]: itemInDefaultLang?.body || '',
        };
      });
    }
    return templates;
  }, [templates, defaultLangFile, locale, defaultLanguage]);

  const SendHelpMessageButton = () => {
    const sendMessage = hooks.useSendMessage();

    const handleHelpButtonClick = useCallback(() => {
      if (file) {
        try {
          const result = lgUtil.evaluate(
            file.id,
            file.content,
            lgFiles,
            templateName.current ?? '',
            JSON.parse(lgProperty.current)
          );
          const activity = ActivityFactory.fromObject(result);
          if (activity) {
            lgResult.current = activity;
          }
        } catch (error) {
          lgResult.current = MessageFactory.text(error.message);
        }
      }
      sendMessage(`run ${templateName.current ?? ''}`);
    }, [sendMessage]);

    return <DefaultButton text="Evaluate" onClick={handleHelpButtonClick} />;
  };

  const store = useMemo(
    () =>
      createStore({}, () => (next: (arg0: { type: any }) => any) => (action: { type: any; payload: any }) => {
        if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY' && action?.payload?.activity?.from?.role === 'bot') {
          if (lgResult.current) {
            Object.assign(action.payload.activity, lgResult.current);
          }
        }
        return next(action);
      }),
    []
  );

  const directLine = useMemo(
    () =>
      createDirectLine({
        token: '0YGXa4bDDsI.fTaNq2FIyafGqdKlF1FddZZkumA93KiVkL2NBZWZ2ic',
      }),
    []
  );

  return (
    <div className={'table-view'} data-testid={'table-view'}>
      <ScrollablePane scrollbarVisibility={ScrollbarVisibility.auto}>
        <DetailsList
          className="table-view-list"
          columns={getTableColums()}
          componentRef={listRef}
          getKey={getKeyCallback}
          //initialFocusedIndex={focusedIndex}
          items={templatesToRender}
          // getKey={item => item.name}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          styles={{
            root: {
              overflowX: 'hidden',
              // hack for https://github.com/OfficeDev/office-ui-fabric-react/issues/8783
              selectors: {
                'div[role="row"]:hover': {
                  background: 'none',
                },
              },
            },
          }}
          onRenderDetailsFooter={onRenderDetailsFooter}
          onRenderDetailsHeader={onRenderDetailsHeader}
        />
      </ScrollablePane>

      <Components.Composer
        className="webchat__chat"
        directLine={directLine}
        store={store}
        styleOptions={{
          bubbleBackground: '#F4F4F4',
          bubbleBorderColor: '#F4F4F4',
          bubbleBorderRadius: 4,
          bubbleBorderWidth: 2,
          bubbleNubOffset: 0,
          bubbleNubSize: 10,
          hideUploadButton: true,
          rootHeight: 800,

          bubbleFromUserBackground: '#3178c6',
          bubbleFromUserBorderColor: '#3178c6',
          bubbleFromUserBorderRadius: 4,
          bubbleFromUserBorderWidth: 2,
          bubbleFromUserNubOffset: 0,
          bubbleFromUserNubSize: 10,
          bubbleFromUserTextColor: 'White',
        }}
        userID={'default-user'}
      >
        <Panel closeButtonAriaLabel="Close" headerText="LG Evaluation" isOpen={isOpen} onDismiss={dismissPanel}>
          <TextField
            multiline
            label="Standard"
            placeholder="please input the properties"
            rows={8}
            onChange={(e, newValue) => (lgProperty.current = newValue ?? '{}')}
          />
          <SendHelpMessageButton />
          <Components.BasicWebChat />
        </Panel>
      </Components.Composer>
    </div>
  );
};

export default TableView;
