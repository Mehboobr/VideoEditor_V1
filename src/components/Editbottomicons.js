import { StyleSheet, Text, View ,TouchableOpacity} from 'react-native'
import React from 'react';
import "./global.css";
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';


const Editbottomicons = () => {
    return (
        <View className="absolute bottom-0 left-0 right-0 px-2 pb-6 flex-row items-center justify-center gap-8">
            <View className="items-center">
                <TouchableOpacity
                    onPress={getPickerOptions}
                    className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
                >
                    <Feather name="brightness-6" size={32} color="black" />
                </TouchableOpacity>
                <Text className="text-white text-xs font-medium">Crop</Text>
            </View>

            <View className="items-center">
                <TouchableOpacity
                    onPress={getPickerOptions}
                    className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
                >
                    <Feather name="edit" size={32} color="black" />
                </TouchableOpacity>
                <Text className="text-white text-xs font-medium">Edit</Text>
            </View>

            <View className="items-center">
                <TouchableOpacity
                    onPress={getPickerOptions}
                    className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
                >
                    <Ionicons name="text" size={32} color="black" />
                </TouchableOpacity>
                <Text className="text-white text-xs font-medium">Text</Text>
            </View>

            <View className="items-center">
                <TouchableOpacity
                    onPress={getPickerOptions}
                    className="w-16 h-16 bg-blue-300 rounded-xl items-center justify-center mb-1"
                >
                    <MaterialIcons name="keyboard-voice" size={32} color="black" />
                </TouchableOpacity>
                <Text className="text-white text-xs font-medium">Voice Over</Text>
            </View>
        </View>
    )
}

export default Editbottomicons
