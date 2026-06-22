import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';
import IdentificationScreen from '../screens/IdentificationScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MapScreen from '../screens/MapScreen';
import PollutionScreen from '../screens/PollutionScreen';
import MolecularMarkerScreen from '../screens/MolecularMarkerScreen';
import LogCatchScreen from '../screens/LogCatchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommunityScreen from '../screens/CommunityScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import ClubsScreen from '../screens/ClubsScreen';
import ClubDetailScreen from '../screens/ClubDetailScreen';
import SpotsScreen from '../screens/SpotsScreen';
import SpotDetailScreen from '../screens/SpotDetailScreen';
import SpotNavigationScreen from '../screens/SpotNavigationScreen';
import ChartersScreen from '../screens/ChartersScreen';

const Tab = createBottomTabNavigator();
const CameraStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const CommunityStack = createNativeStackNavigator();
const SpotsStack = createNativeStackNavigator();

const THEME = {
  background: '#0a1628',
  surface: '#0f2044',
  card: '#142954',
  accent: '#00d4aa',
  text: '#e8f4fd',
  subtext: '#8ab4d4',
  tabBar: '#0a1628',
};

function CameraStackNavigator() {
  return (
    <CameraStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.background },
      }}
    >
      <CameraStack.Screen name="CameraCapture" component={CameraScreen} />
      <CameraStack.Screen name="Identification" component={IdentificationScreen} />
      <CameraStack.Screen name="LogCatch" component={LogCatchScreen} />
    </CameraStack.Navigator>
  );
}

function HomeStackNavigator({ onLogout }) {
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.background },
      }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Identification" component={IdentificationScreen} />
      <HomeStack.Screen name="LogCatch" component={LogCatchScreen} />
      <HomeStack.Screen name="Pollution" component={PollutionScreen} />
      <HomeStack.Screen name="Molecular" component={MolecularMarkerScreen} />
    </HomeStack.Navigator>
  );
}

function CommunityStackNavigator() {
  return (
    <CommunityStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.background },
      }}
    >
      <CommunityStack.Screen name="CommunityFeed" component={CommunityScreen} />
      <CommunityStack.Screen name="PostDetail" component={PostDetailScreen} />
      <CommunityStack.Screen name="Clubs" component={ClubsScreen} />
      <CommunityStack.Screen name="ClubDetail" component={ClubDetailScreen} />
    </CommunityStack.Navigator>
  );
}

function SpotsStackNavigator() {
  return (
    <SpotsStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.background },
      }}
    >
      <SpotsStack.Screen name="SpotsList" component={SpotsScreen} />
      <SpotsStack.Screen name="SpotDetail" component={SpotDetailScreen} />
      <SpotsStack.Screen name="SpotNavigation" component={SpotNavigationScreen} />
      <SpotsStack.Screen name="Charters" component={ChartersScreen} />
    </SpotsStack.Navigator>
  );
}

function ProfileTabScreen({ navigation, route, onLogout }) {
  // Forward the real navigation prop so goBack() and navigate() work correctly
  return (
    <ProfileScreen
      navigation={navigation}
      route={{ ...route, params: { ...(route?.params ?? {}), onLogout } }}
    />
  );
}

export default function AppNavigator({ onLogout }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 62 + insets.bottom;

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: THEME.accent,
          background: THEME.background,
          card: THEME.surface,
          text: THEME.text,
          border: THEME.card,
          notification: THEME.accent,
        },
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: THEME.accent,
          tabBarInactiveTintColor: THEME.subtext,
          tabBarStyle: {
            backgroundColor: THEME.tabBar,
            borderTopColor: THEME.card,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Home: focused ? 'home' : 'home-outline',
              Spots: focused ? 'location' : 'location-outline',
              Camera: focused ? 'camera' : 'camera-outline',
              Community: focused ? 'people' : 'people-outline',
              Profile: focused ? 'person' : 'person-outline',
            };
            return (
              <View style={focused ? styles.activeTab : null}>
                <Ionicons name={icons[route.name]} size={22} color={color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Home">
          {() => <HomeStackNavigator onLogout={onLogout} />}
        </Tab.Screen>
        <Tab.Screen name="Spots" component={SpotsStackNavigator} />
        <Tab.Screen
          name="Camera"
          component={CameraStackNavigator}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={26} color="#fff" />
              </View>
            ),
            tabBarLabel: '',
          }}
        />
        <Tab.Screen name="Community" component={CommunityStackNavigator} />
        <Tab.Screen name="Profile">
          {(props) => <ProfileTabScreen {...props} onLogout={onLogout} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00d4aa',
    paddingBottom: 2,
  },
  cameraButton: {
    backgroundColor: '#00d4aa',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
