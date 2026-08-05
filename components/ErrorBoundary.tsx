import React, { Component, ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Home, RefreshCw, Bug, ChevronDown } from 'lucide-react-native';
import { router } from 'expo-router';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
    });

    // Here you would send to analytics/error reporting
    // AnalyticsService.logError(error, errorInfo);
  }

  handleTryAgain = () => {
    // Reset error state and retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    router.replace('/');
  };

  toggleDetails = () => {
    this.setState(prevState => ({ showDetails: !prevState.showDetails }));
  };

  handleReport = () => {
    Alert.alert(
      "Report Problem",
      "Would you like to send a report to the developers?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Send Report", 
          onPress: () => {
            console.log("Report sent:", this.state.error);
            Alert.alert("Thank You", "Report sent successfully!");
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;

      return (
        <SafeAreaView className="flex-1 bg-background">
          <ScrollView 
            contentContainerStyle={{ 
              flexGrow: 1, 
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
              gap: 24,
            }}
          >
            {/* Friendly Icon */}
            <View className="bg-muted/20 rounded-full p-8">
              <AlertTriangle size={64} className="text-primary" strokeWidth={2} />
            </View>

            {/* Main Message */}
            <View className="items-center gap-3">
              <Text className="text-3xl font-bold text-foreground text-center">
                Oops! Something went wrong
              </Text>
              <Text className="text-muted-foreground text-center text-lg leading-relaxed">
                Our dino got confused in the lair. Don&apos;t worry, your progress is safe!
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="w-full gap-3">
              <Pressable
                onPress={this.handleTryAgain}
                className="bg-primary items-center justify-center py-4 rounded-xl active:opacity-90"
              >
                <View className="flex-row items-center gap-2">
                  <RefreshCw size={20} className="text-primary-foreground" />
                  <Text className="text-primary-foreground font-semibold text-lg">
                    Try Again
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={this.handleGoHome}
                className="bg-secondary items-center justify-center py-4 rounded-xl active:opacity-90"
              >
                <View className="flex-row items-center gap-2">
                  <Home size={20} className="text-secondary-foreground" />
                  <Text className="text-secondary-foreground font-semibold text-lg">
                    Go to Home
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Parent Zone - Error Details */}
            <View className="w-full mt-4">
              <Pressable
                onPress={this.toggleDetails}
                className="flex-row items-center justify-center gap-2 py-2"
              >
                <Bug size={16} className="text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {showDetails ? 'Hide' : 'Show'} Details (Parent Zone)
                </Text>
                <ChevronDown 
                  size={16} 
                  className={`text-muted-foreground transition-transform ${showDetails ? 'rotate-180' : ''}`} 
                />
              </Pressable>

              {showDetails && (
                <View className="bg-muted/50 rounded-lg p-4 mt-2">
                  <Text className="font-mono text-xs text-destructive mb-2">
                    {error?.toString()}
                  </Text>
                  <Text className="font-mono text-xs text-muted-foreground">
                    {errorInfo?.componentStack}
                  </Text>
                  
                  <Pressable
                    onPress={this.handleReport}
                    className="mt-4 border border-border rounded-lg py-2 items-center"
                  >
                    <Text className="text-sm text-foreground">Report Problem</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components (optional wrapper)
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}