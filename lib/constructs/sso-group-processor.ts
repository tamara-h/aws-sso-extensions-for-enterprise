/*
composite construct that sets up all resources
for SSO event life cycle notifications
*/
import { ILayerVersion, Runtime } from "aws-cdk-lib/aws-lambda"; // Importing external resources in CDK would use interfaces and not base objects
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { ITopic } from "aws-cdk-lib/aws-sns"; // Importing external resources in CDK would use interfaces and not base objects
import { Construct } from "constructs";
import { join } from "path";
import { BuildConfig } from "../build/buildConfig";

function name(buildConfig: BuildConfig, resourcename: string): string {
  return buildConfig.Environment + "-" + resourcename;
}

export interface SSOGroupProcessorProps {
  readonly linksTableName: string;
  readonly permissionSetArnTableName: string;
  readonly linkQueueUrl: string;
  readonly errorNotificationsTopicArn: string;
  readonly nodeJsLayer: ILayerVersion;
  readonly ssoGroupEventNotificationsTopic: ITopic;
  readonly ssoUserEventNotificationsTopic: ITopic;
  readonly listInstancesSSOAPIRoleArn: string;
  readonly listGroupsIdentityStoreAPIRoleArn: string;
  readonly orgListSMRoleArn: string;
  readonly processTargetAccountSMTopic: ITopic;
}

export class SSOGroupProcessor extends Construct {
  public readonly ssoGroupHandler: NodejsFunction;
  public readonly ssoUserHandler: NodejsFunction;

  constructor(
    scope: Construct,
    id: string,
    buildConfig: BuildConfig,
    ssoGroupProcessorProps: SSOGroupProcessorProps
  ) {
    super(scope, id);

    this.ssoGroupHandler = new NodejsFunction(
      this,
      name(buildConfig, "ssoGroupHandler"),
      {
        runtime: Runtime.NODEJS_16_X,
        functionName: name(buildConfig, "ssoGroupHandler"),
        entry: join(
          __dirname,
          "../",
          "lambda-functions",
          "application-handlers",
          "src",
          "groupsCud.ts"
        ),
        bundling: {
          externalModules: [
            "@aws-sdk/client-dynamodb",
            "@aws-sdk/lib-dynamodb",
            "@aws-sdk/client-sns",
            "@aws-sdk/client-sfn",
            "@aws-sdk/client-sso-admin",
            "@aws-sdk/credential-providers",
            "@aws-sdk/client-sqs",
            "uuid",
          ],
          minify: true,
        },
        layers: [ssoGroupProcessorProps.nodeJsLayer],
        environment: {
          permissionarntable: ssoGroupProcessorProps.permissionSetArnTableName,
          linkstable: ssoGroupProcessorProps.linksTableName,
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
          linkQueueUrl: ssoGroupProcessorProps.linkQueueUrl,
          errorNotificationsTopicArn:
            ssoGroupProcessorProps.errorNotificationsTopicArn,
          SSOAPIRoleArn: ssoGroupProcessorProps.listInstancesSSOAPIRoleArn,
          processTargetAccountSMTopicArn:
            ssoGroupProcessorProps.processTargetAccountSMTopic.topicArn,
          orgListSMRoleArn: ssoGroupProcessorProps.orgListSMRoleArn,
          processTargetAccountSMArn: `arn:aws:states:us-east-1:${buildConfig.PipelineSettings.OrgMainAccountId}:stateMachine:${buildConfig.Environment}-processTargetAccountSM`,
          ssoRegion: buildConfig.PipelineSettings.SSOServiceAccountRegion,
        },
      }
    );

    this.ssoGroupHandler.addEventSource(
      new SnsEventSource(ssoGroupProcessorProps.ssoGroupEventNotificationsTopic)
    );

    this.ssoUserHandler = new NodejsFunction(
      this,
      name(buildConfig, "ssoUserHandler"),
      {
        runtime: Runtime.NODEJS_16_X,
        functionName: name(buildConfig, "ssoUserHandler"),
        entry: join(
          __dirname,
          "../",
          "lambda-functions",
          "application-handlers",
          "src",
          "usersCud.ts"
        ),
        bundling: {
          externalModules: [
            "@aws-sdk/client-dynamodb",
            "@aws-sdk/lib-dynamodb",
            "@aws-sdk/client-sns",
            "@aws-sdk/client-sfn",
            "@aws-sdk/client-sso-admin",
            "@aws-sdk/client-identitystore",
            "@aws-sdk/credential-providers",
            "@aws-sdk/client-sqs",
            "@aws-sdk/credential-providers",
            "uuid",
          ],
          minify: true,
        },
        layers: [ssoGroupProcessorProps.nodeJsLayer],
        environment: {
          permissionarntable: ssoGroupProcessorProps.permissionSetArnTableName,
          linkstable: ssoGroupProcessorProps.linksTableName,
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
          linkQueueUrl: ssoGroupProcessorProps.linkQueueUrl,
          errorNotificationsTopicArn:
            ssoGroupProcessorProps.errorNotificationsTopicArn,
          SSOAPIRoleArn: ssoGroupProcessorProps.listInstancesSSOAPIRoleArn,
          ISAPIRoleArn:
            ssoGroupProcessorProps.listGroupsIdentityStoreAPIRoleArn,
          processTargetAccountSMTopicArn:
            ssoGroupProcessorProps.processTargetAccountSMTopic.topicArn,
          orgListSMRoleArn: ssoGroupProcessorProps.orgListSMRoleArn,
          processTargetAccountSMArn: `arn:aws:states:us-east-1:${buildConfig.PipelineSettings.OrgMainAccountId}:stateMachine:${buildConfig.Environment}-processTargetAccountSM`,
          ssoRegion: buildConfig.PipelineSettings.SSOServiceAccountRegion,
        },
      }
    );

    this.ssoUserHandler.addEventSource(
      new SnsEventSource(ssoGroupProcessorProps.ssoUserEventNotificationsTopic)
    );
  }
}
